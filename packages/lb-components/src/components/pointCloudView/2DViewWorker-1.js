
importScripts('https://unpkg.com/comlink/dist/umd/comlink.js');

async function annotations2dHandler(
  currentData,
  displayPointCloudList,
  selectedID,
  highlightAttribute,
  imageSizes,
  config,
  polygonList,
  selectedIDs,
  pointCloudLidar2image,
  pointListLidar2Img,
  getBoundingRect,
  isBoundingRectInImage,
  toolStyleConverter,
  isNumber,
) {
  const defaultViewStyle = {
    fill: 'transparent',
    color: 'green',
  };
  const formatViewDataPointList = ({
    viewDataPointList,
    pointCloudBox,
    defaultViewStyle,
    stroke,
  }) => {
    if (!viewDataPointList) {
      return [];
    }
    return viewDataPointList.map((v) => {
      return {
        type: v.type,
        annotation: {
          id: pointCloudBox.id,
          pointList: v.pointList,
          ...defaultViewStyle,
          stroke,
        },
      };
    });
  };
  let newAnnotations2dList= [];
  for (let mappingData of currentData?.mappingImgList) {
    const newAnnotations2d = await displayPointCloudList.reduce(
      async (acc, pointCloudBox) => {
        /**
         * Is need to create range.
         * 1. pointCloudBox is selected;
         * 2. HighlightAttribute is same with pointCloudBox's attribute.
         */
        acc = await acc;
        const createRange =
          pointCloudBox.id === selectedID || highlightAttribute === pointCloudBox.attribute;
        const { transferViewData: viewDataPointList, viewRangePointList } = await pointCloudLidar2image(pointCloudBox, mappingData.calib, {
            createRange,
          }) ?? {};

        if (!viewDataPointList || !viewRangePointList) {
          return [];
        }
        // eslint-disable-next-line max-nested-callbacks
        const tmpPoints = viewDataPointList.reduce((acc, v) => {
          if (v.type === 'line') {
            return [...acc, ...v.pointList];
          }
          return acc;
        }, []);

        const obh = await getBoundingRect(tmpPoints)
        const boundingRect = {
          ...obh,
          imageName: mappingData.path,
        };

        const isRectInImage = await isBoundingRectInImage(boundingRect, mappingData.path, imageSizes);

        if (!isRectInImage) {
          return acc;
        }

        const stroke = await toolStyleConverter.getColorFromConfig(
          { attribute: pointCloudBox.attribute },
          {
            ...config,
            attributeConfigurable: true,
          },
          {},
        );
        const viewDataPointLists = formatViewDataPointList({
          viewDataPointList,
          pointCloudBox,
          defaultViewStyle,
          stroke: stroke.stroke,
        });
        const newArr = [...acc, ...viewDataPointLists];

        if (viewRangePointList?.length > 0) {
          newArr.unshift({
            type: 'polygon',
            annotation: {
              id: selectedID,
              pointList: viewRangePointList,
              ...defaultViewStyle,
              stroke: stroke.stroke,
              fill: 'rgba(255, 255, 255, 0.6)',
            },
          });
        }

        return newArr;
      },
      [],
    );
    const imageSize = imageSizes[mappingData?.path ?? ''];

    if (imageSize && isNumber(mappingData?.calib?.groundHeight)) {
      for (let polygon of polygonList) {
        // eslint-disable-next-line
        const polygonPoints = polygon.pointList.map((v) => ({
          ...v,
          z: mappingData?.calib?.groundHeight,
        }));
        // 上面用isNumber确保z的值是number，但是ts还是报错，所以这里用//@ts-ignore忽略
        // @ts-ignore
        const result = await pointListLidar2Img(polygonPoints, mappingData?.calib, imageSize);

        if (result) {
          const polygonColor = await toolStyleConverter.getColorFromConfig(
            { attribute: polygon.attribute },
            {
              ...config,
              attributeConfigurable: true,
            },
            {},
          );

          newAnnotations2d.push({
            type: 'polygon',
            annotation: {
              id: polygon.id,
              pointList: result,
              ...defaultViewStyle,
              stroke: polygonColor?.stroke,
              fill: selectedIDs.includes(polygon.id)
                ? polygonColor?.fill
                : 'rgba(255, 255, 255, 0.6)',
            },
          });
        }
      }
    }
    
    newAnnotations2dList.push({
      annotations: newAnnotations2d,
      url: mappingData?.url,
      fallbackUrl: mappingData?.fallbackUrl ?? '',
      calName: mappingData?.calib?.calName,
      calib: mappingData?.calib,
      path: mappingData?.path,
    });
  }
  return newAnnotations2dList;
}

Comlink.expose(annotations2dHandler);
