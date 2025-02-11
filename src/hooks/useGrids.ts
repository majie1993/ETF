import { useAppState, State } from '../common/store';

// 网格类型
export enum GearType {
  small = '小网',
  middle = '中网',
  big = '大网'
}

// 网格幅度
export enum GearPercent {
  small = 0.05,
  middle = 0.15,
  big = 0.3
}

type Grid = {
  // 类型
  type: GearType;
  // 档位
  gear: number;
  // 买入价格
  buyPrice: number;
  // 卖出价格
  sellPrice: number;
  // 买入金额
  buyAmount: number;
  // 买入数量
  buyCount: number;
  // 卖出金额
  sellAmount: number;
  // 卖出数量
  sellCount: number;
  // 盈利金额
  profits: number;
  // 盈利比例
  returnRate: string;
  // 本期留存利润
  retainedProfits: number;
  // 本期留存数量
  retainedCount: number;
};

export const toFixedString = (value: number, digits = 3): string => {
  return value.toFixed(digits);
};
export const toFixedNumber = (value: number, digits = 3): number => {
  return parseFloat(toFixedString(value, digits));
};

type GridOptions = Pick<State, 'numberOfRetainedProfits' | 'price'> &
  Pick<Grid, 'type' | 'gear' | 'buyAmount'> & {
    percent: GearPercent;
  };

// 数字精度问题
const divide = (v1: number, v2: number) => {
  return parseFloat((v1 / v2).toPrecision(14));
};
const T_MIDDLE = divide(GearPercent.middle, GearPercent.small);
const T_BIG = divide(GearPercent.big, GearPercent.small);

export const createGrid = (options: GridOptions): Grid => {
  const {
    numberOfRetainedProfits,
    type,
    gear,
    price,
    percent,
    buyAmount: __buyAmount
  } = options;
  const buyPrice = gear * price;
  // 买入必须按照100份整数
  const buyCount = Math.floor(__buyAmount / buyPrice);
  const buyAmount = buyCount * buyPrice;
  const sellPrice = (gear + percent) * price;
  const currentAmount = buyCount * sellPrice;
  const profits = currentAmount - buyAmount;
  const returnRate = toFixedString((profits / buyAmount) * 100, 2) + '%';
  let retainedProfits = profits * numberOfRetainedProfits;
  // 卖出必须按照100份整数
  const sellCount =
    Math.floor((currentAmount - retainedProfits) / sellPrice);
  const sellAmount = sellCount * sellPrice;
  retainedProfits = currentAmount - sellAmount;
  const retainedCount = retainedProfits / sellPrice;

  return {
    type,
    gear,
    buyAmount: buyAmount,
    buyCount,
    buyPrice,
    sellPrice,
    sellAmount,
    sellCount,
    profits,
    returnRate,
    retainedProfits,
    retainedCount
  };
};

export function useGrids() {
  const state = useAppState();
  const {
    price,
    amount,
    maxPercentOfDecline,
    increasePercentPerGrid,
    numberOfRetainedProfits,
    hasMiddleGrid,
    hasBigGrid
  } = state;

  const grids: Grid[] = [];

  //  “
  // 设计交易表格的时候，根据具体情况，模拟最大下跌幅度。
  // 比如说，你现在要开始一个中证500的网格，那你就应该知道，下跌60%，几乎一定是最坏情况了。
  // 甚至下跌50%也非常困难。
  // 那么你如果相对来说激进一点，就可以以40%设计压力测试。
  // 保守一点，就按照50%或者60%设计。
  // ”
  //                                    —— 摘自E大公众号

  const maxGear = 1;
  const minGear = (1 - maxPercentOfDecline) * maxGear;

  let gear = maxGear;
  let i = 0;
  let j = 0;
  let k = 0;

  while (gear >= minGear) {
    const buyAmount = toFixedNumber(
      (increasePercentPerGrid * i + 1) * amount,
      0
    );

    grids.push(
      createGrid({
        type: GearType.small,
        buyAmount,
        gear,
        percent: GearPercent.small,
        numberOfRetainedProfits,
        price
      })
    );

    // 中网幅度15%
    if (hasMiddleGrid && i && i % T_MIDDLE === 0) {
      j++;
      grids.push(
        createGrid({
          type: GearType.middle,
          buyAmount,
          gear: toFixedNumber(1 - j * GearPercent.middle),
          percent: GearPercent.middle,
          numberOfRetainedProfits,
          price
        })
      );
    }

    // 大网幅度30%
    if (hasBigGrid && i && i % T_BIG === 0) {
      k++;
      grids.push(
        createGrid({
          type: GearType.big,
          buyAmount,
          gear: toFixedNumber(1 - k * GearPercent.big),
          percent: GearPercent.big,
          numberOfRetainedProfits,
          price
        })
      );
    }

    i++;
    gear = toFixedNumber(1 - i * GearPercent.small);
  }

  return grids;
}
