/**
 * @file Save the highlight Info.
 * @createDate 2023-08-08
 * @author Ron <ron.f.luo@gmail.com>
 */

import { useCallback, useContext } from 'react';
import { PointCloudContext } from '../PointCloudContext';
import { IAnnotationStateProps } from '../../../store/annotation/map';
import { ICalib } from '@labelbee/lb-utils';

const useHighlight = ({ currentData }: Partial<IAnnotationStateProps>) => {
  const {
    mainViewInstance,
    topViewInstance,
    pointCloudBoxList,
    highlight2DDataList,
    setHighlight2DDataList,
  } = useContext(PointCloudContext);
  const mappingImgList = currentData?.mappingImgList ?? [];

  const toggle2dVisible = async (url: string, fallbackUrl: string, calib?: ICalib) => {
    let newHighlightList: Array<{ url: string; fallbackUrl: string; calib?: ICalib }> = [
      ...highlight2DDataList,
    ];

    // Update highlight Status.
    if (highlight2DDataList.find((v) => v.url === url)) {
      newHighlightList = highlight2DDataList.filter((v) => v.url !== url);
    } else {
      newHighlightList.push({
        url,
        fallbackUrl,
        calib,
      });
    }

    setHighlight2DDataList(newHighlightList);

    if (!mainViewInstance || mappingImgList?.length === 0) {
      return;
    }

    const points = mainViewInstance.pointCloudObject;
    if (!points) {
      return;
    }

    // 兼容 THREE.Points 和 PointCloudOctree 两种类型
    let pointsArray: ArrayLike<number>;
    if ('geometry' in points && points.geometry) {
      // THREE.Points 类型
      pointsArray = (points as any).geometry.attributes.position.array;
    } else {
      // PointCloudOctree 类型：暂时不支持，返回空数组
      // TODO: 需要从 PointCloudOctree 中提取点的位置数据
      console.warn('PointCloudOctree type is not supported for highlight yet');
      return;
    }

    const highlightIndex = await mainViewInstance.getHighlightIndexByMappingImgList({
      mappingImgList: newHighlightList,
      points: pointsArray,
    });

    try {
      const colorInfo = await mainViewInstance.highlightOriginPointCloud(
        pointCloudBoxList,
        highlightIndex,
      );
      const { color } = colorInfo ?? {};
      color && topViewInstance?.pointCloudInstance?.updateColor(color);
    } catch (error) {
      console.error('toggle2dVisible highlightOriginPointCloud error:', error);
    }
  };

  const isHighlightVisible = useCallback(
    (url: string) => {
      return highlight2DDataList.findIndex((v) => v.url === url) >= 0;
    },
    [highlight2DDataList],
  );

  return {
    toggle2dVisible,
    isHighlightVisible,
  };
};

export { useHighlight };
