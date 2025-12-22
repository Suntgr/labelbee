import * as THREE from 'three';

export function patchPotreeMaterialForColorMap(material: any) {
  if (material.__colorMapPatched) return;
  material.__colorMapPatched = true;

  // 1) 确保 uniforms 存在（RawShaderMaterial 用这个）
  material.uniforms = material.uniforms || {};
  material.uniforms.useColorMap = material.uniforms.useColorMap ?? { value: false };
  material.uniforms.colorMap = material.uniforms.colorMap ?? { value: new THREE.Texture() };
  material.uniforms.colorMapBounds = material.uniforms.colorMapBounds ?? { value: new THREE.Vector4(0, 0, 1, 1) };
  material.uniforms.colorMapOpacity = material.uniforms.colorMapOpacity ?? { value: 1.0 };

  const inject = () => {
    if (material.__colorMapInjected) return;
    let vs: string = material.vertexShader;

    // 2) 注入 uniform 声明（放在 depthMap 后面，尽量稳定匹配）
    if (!vs.includes('uniform bool useColorMap;')) {
      vs = vs.replace(
        'uniform sampler2D depthMap;',
        `uniform sampler2D depthMap;
         uniform bool useColorMap;
         uniform sampler2D colorMap;
         uniform vec4 colorMapBounds;   
         uniform float colorMapOpacity;`,
      );
    }

    // 3) 注入采样逻辑（放在 COLOR ENCODING ADJUSTMENTS 之后，确保最后执行）
    // 这样不会被其他颜色处理逻辑覆盖
    if (!vs.includes('// COLOR MAP OVERLAY')) {
      // 尝试在 COLOR ENCODING ADJUSTMENTS 之后、main 函数结束之前注入
      // 匹配模式：COLOR ENCODING ADJUSTMENTS 的结束到 main 函数的 }
      const encodingPattern = /\/\/ COLOR ENCODING ADJUSTMENTS[\S\s]*?#endif\s*\n}/;
      const colorMapCode = `
// COLOR MAP OVERLAY (fast path for many rectangles)
// 放在最后执行，确保高亮颜色不被其他逻辑覆盖
#if !defined(color_type_point_index)
  if (useColorMap) {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec2 uv = (world.xy - colorMapBounds.xy) / colorMapBounds.zw;
    if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
      vec4 mapColor = texture(colorMap, uv);
      if (mapColor.a > 0.35) {
        // 直接替换颜色，确保高亮颜色完全显示（不混合原色）
        #ifdef new_format
          vColor.xyz = mapColor.rgb;
        #else
          vColor = mapColor.rgb;
        #endif
      }
    }
  }
#endif
`;
      if (encodingPattern.test(vs)) {
        // 在 COLOR ENCODING ADJUSTMENTS 之后注入
        vs = vs.replace(encodingPattern, (match) => match.replace(/\n}$/, `${colorMapCode}}`));
      } else {
        // 如果没有 COLOR ENCODING ADJUSTMENTS，在 CLIPPING 之前注入（向后兼容）
        vs = vs.replace(
          '\t// CLIPPING',
          `// COLOR MAP OVERLAY (fast path for many rectangles)
#if !defined(color_type_point_index)
  if (useColorMap) {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec2 uv = (world.xy - colorMapBounds.xy) / colorMapBounds.zw;
    if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
      vec4 mapColor = texture(colorMap, uv);
      if (mapColor.a > 0.35) {
        // 直接替换颜色，确保高亮颜色完全显示（不混合原色）
        #ifdef new_format
          vColor.xyz = mapColor.rgb;
        #else
          vColor = mapColor.rgb;
        #endif
      }
    }
  }
#endif

\t// CLIPPING`,
        );
      }
    }

    material.vertexShader = vs;
    material.__colorMapInjected = true;
    material.needsUpdate = true;
  };

  // 4) 关键：Potree 的材质会自己 rebuild shader，所以要“每次 rebuild 后再注入一次”
  const origUpdateShaderSource = material.updateShaderSource?.bind(material);
  if (origUpdateShaderSource) {
    material.updateShaderSource = () => {
      material.__colorMapInjected = false;
      origUpdateShaderSource();
      inject();
    };
  }

  // 立即注入一次（你已经设置好 pointColorType/sizeType 后调用最好）
  inject();
}

type RectLike = {
  center: { x: number; y: number; z?: number };
  width: number;
  height: number;
  rotation: number; // 弧度，绕 Z
  // 你截图里还有 attribute/trackId/uuid... 都可以用来决定颜色
  attribute?: string;
};

export function updateColorMapFromRects(params: {
  material: any;
  rects: RectLike[];
  boundsXY: { minX: number; minY: number; maxX: number; maxY: number };
  resolution?: number; // 1024/2048
  opacity?: number; // 0~1
  getColor?: (r: RectLike) => string | number | THREE.Color; // per-rect 颜色
}) {
  const { material, rects, boundsXY } = params;
  const resolution = params.resolution ?? 2048;
  const opacity = params.opacity ?? 1.0;

  // 1) 复用 canvas/texture
  let canvas: HTMLCanvasElement = material.__colorMapCanvas;
  if (!canvas || canvas.width !== resolution || canvas.height !== resolution) {
    canvas = document.createElement('canvas');
    canvas.width = resolution;
    canvas.height = resolution;
    material.__colorMapCanvas = canvas;

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.flipY = false; // 我们按 WebGL “底部是 v=0” 的方式画
    material.__colorMapTexture = tex;
  }

  const tex: THREE.CanvasTexture = material.__colorMapTexture;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, resolution, resolution);

  const { minX, minY, maxX, maxY } = boundsXY;
  const sizeX = Math.max(1e-9, maxX - minX);
  const sizeY = Math.max(1e-9, maxY - minY);

  const colorTmp = new THREE.Color();

  for (const r of rects) {
    const cx = ((r.center.x - minX) / sizeX) * resolution;
    const cy = ((r.center.y - minY) / sizeY) * resolution; // flipY=false => y 不用倒过来

    const w = (r.width / sizeX) * resolution;
    const h = (r.height / sizeY) * resolution;

    const c = params.getColor?.(r);
    colorTmp.set(c as any);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(r.rotation);
    ctx.fillStyle = `#${colorTmp.getHexString()}`;
    ctx.fillRect(-w * 0.5, -h * 0.5, w, h);
    ctx.restore();
  }

  tex.needsUpdate = true;

  // 2) 设置 uniforms
  material.uniforms.useColorMap.value = true;
  material.uniforms.colorMap.value = tex;
  material.uniforms.colorMapBounds.value.set(minX, minY, sizeX, sizeY);
  material.uniforms.colorMapOpacity.value = opacity;
}
