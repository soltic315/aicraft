// config.js - 後方互換バレルファイル
// 各定数・関数は以下のモジュールに分割されています:
//   src/constants/gameConstants.js    - コアゲーム定数
//   src/constants/survivalConstants.js - サバイバル・戦闘定数
//   src/constants/mobConstants.js     - モブ定数
//   src/constants/renderConstants.js  - レンダリング定数
//   src/data/craftRecipes.js          - クラフト・精錬レシピ
//   src/utils/math.js                 - 数学ユーティリティ
//   src/utils/physics.js              - 物理ユーティリティ
//   src/utils/settings.js             - 設定バリデーション
//   src/utils/positioning.js          - 座標キー変換

export * from './constants/gameConstants.js';
export * from './constants/survivalConstants.js';
export * from './constants/mobConstants.js';
export * from './constants/renderConstants.js';
export * from './data/craftRecipes.js';
export * from './utils/math.js';
export * from './utils/physics.js';
export * from './utils/settings.js';
export * from './utils/positioning.js';
