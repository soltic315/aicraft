// Main game entry point
import { render, h } from 'preact';
import { EventBus } from './eventBus.js';
import { SoundManager } from './SoundManager.js';
import { InputManager } from './InputManager.js';
import { GameController } from './GameController.js';
import { App } from './ui/App.jsx';
import { SAVE_STORAGE_KEY } from './config.js';

const eventBus = new EventBus();
const sound = new SoundManager();
const input = new InputManager(eventBus);

// セーブデータの有無を先に確認してタイトル画面のボタン表示に反映
window.__aicraft = {
  hasSavedGame: Boolean(localStorage.getItem(SAVE_STORAGE_KEY)),
  eventBus,
};

// タイトル画面を先に描画してからGameControllerを初期化
// （SESによりsetTimeoutが無効化されることがあるためrequestAnimationFrameを使用）
render(h(App, null), document.getElementById('ui-root'));

requestAnimationFrame(() => {
  const game = new GameController(eventBus, sound, input);
  game.init();
});
