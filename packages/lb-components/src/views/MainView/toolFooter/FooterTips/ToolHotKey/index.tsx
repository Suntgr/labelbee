import { Popover } from 'antd';
import _ from 'lodash';
import React, { useState } from 'react';
import { useSelector } from 'react-redux';
// import styles from './index.less';

import hotKeySvg from '@/assets/annotation/toolHotKeyIcon/icon_kj.svg';
import hotKeyHoverSvg from '@/assets/annotation/toolHotKeyIcon/icon_kj_h.svg';
import { EToolName } from '@/data/enums/ToolType';
import rectToolShortcutTable from './rectToolShortCutTable';
import pointToolShortcutTable from './point';
import polygonToolShortcutTable from './polygon';
import lineToolShortCutTable from './line';
import tagToolSingleShortCutTable from './tag';
import textToolShortCutTable from './text';
import StepUtils from '@/utils/StepUtils';
import { footerCls } from '../../index';

interface IProps {
  isSingleImg?: boolean;
  style?: any;
}

const shortCutTable: any = {
  [EToolName.Rect]: rectToolShortcutTable,
  [EToolName.Tag]: tagToolSingleShortCutTable,
  [EToolName.Point]: pointToolShortcutTable,
  [EToolName.Polygon]: polygonToolShortcutTable,
  [EToolName.Line]: lineToolShortCutTable,
  [EToolName.Text]: textToolShortCutTable,
};

export interface IShortcuts {
  name: string;
  icon: any;
  shortCut: string[];
  noticeInfo?: string;
}
const ToolHotKey: React.FC<IProps> = ({ isSingleImg, style }) => {
  const [svgFlag, setFlag] = useState(false);

  // @ts-ignore
  const stepInfo = useSelector(state => StepUtils.getCurrentStepInfo(state?.annotation?.step, state.annotation?.stepList))

  const renderImg = (info: Element | string) => {
    if (typeof info === 'string') {
      return <img width={16} height={16} src={info} style={iconStyle} />;
    }
    return info;
  };
  const shortCutStyle = {
    width: 250,
    display: 'flex',
    justifyContent: 'space-between',
    margin: '23px 21px',
  };

  const iconStyle = {
    marginRight: 10,
  };

  const shortCutNameStyles: React.CSSProperties = {
    display: 'block',
    padding: '0 3px',
    minWidth: '20px',
    marginRight: '3px',
    border: '1px solid rgba(204,204,204,1)',
    verticalAlign: 'middle',
    fontSize: '12px',
    textAlign: 'center',
  };

  const setHotKey = (info: any, index: number) => (
    <div style={shortCutStyle} key={index}>
      <span style={{ display: 'flex', alignItems: 'center' }}>
        {renderImg(info.icon)}
        {info.name}
      </span>
      <span style={{ display: 'flex', alignItems: 'center' }}>
        {info.noticeInfo && (
        <span style={{ marginRight: '5px', color: '#CCCCCC' }}>{info.noticeInfo}</span>
        )}
        {setSVG(info.shortCut, info.shortCutUseHtml, info.linkSymbol)}
      </span>
    </div>
  );

  const setSVG = (list: any[], useDangerInnerHtml = false, linkSymbol?: string) => {
    const listDom = list.map((item, index) => {
      if (useDangerInnerHtml) {
        return (
          <span key={index} style={{ display: 'flex' }}>
            <span style={shortCutNameStyles} dangerouslySetInnerHTML={{ __html: item }} />
          </span>
        );
      }

      if (index < list.length - 1) {
        if (typeof item === 'number') {
          return (
            <span key={index} style={{ display: 'flex' }}>
              <span style={shortCutNameStyles}>{item}</span>
              <span style={{ marginRight: '3px' }}>~</span>
            </span>
          );
        }

        if (item?.startsWith('data')) {
          return (
            <span key={index} style={{ display: 'flex' }}>
              <span className="shortCutButton" style={{ marginRight: '3px' }}>
                <img width={16} height={23} src={item} />
              </span>
              <span style={{ marginRight: '3px' }}>+</span>
            </span>
          );
        }
        return (
          <span key={index} style={{ display: 'flex' }}>
            <span style={shortCutNameStyles}>{item}</span>
            <span style={{ marginRight: '3px' }}>{linkSymbol || '+'}</span>
          </span>
        );
      }
      if (typeof item === 'number') {
        return (
          <span key={index} style={{ display: 'flex' }}>
            <span style={shortCutNameStyles}>{item}</span>
          </span>
        );
      }
      if (item?.startsWith('data')) {
        return (
          <span className="shortCutButton" key={index} style={{ marginRight: '3px' }}>
            <img width={16} height={23} src={item} />
          </span>
        );
      }
      return (
        <span style={shortCutNameStyles} key={index}>
          {item}
        </span>
      );
    });
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
        }}
      >
        {listDom}
      </div>
    );
  };

  const content = <div className={`${footerCls}__hotkey-content`}>{stepInfo && shortCutTable[stepInfo?.tool]?.map((info: any, index: number) => setHotKey(info, index))}</div>;
  const containerStyle = style || {};

  if (!content) {
    return null;
  }

  return (
    // @ts-ignore
    <Popover placement="topLeft" content={content} onMouseMove={() => setFlag(true)}
      onMouseLeave={() => setFlag(false)}
      overlayClassName="tool-hotkeys-popover"
    >
      <div
        className="shortCutTitle"
        onMouseMove={() => setFlag(true)}
        onMouseLeave={() => setFlag(false)}
        style={containerStyle}
      >
        <a className="svg">
          <img
            src={svgFlag ? hotKeyHoverSvg : hotKeySvg}
            width={15}
            height={13}
            style={{ marginRight: '5px' }}
          />
          快捷键
        </a>
      </div>
    </Popover>
  );
};

export default ToolHotKey;
