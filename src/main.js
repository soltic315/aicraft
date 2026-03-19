// Main game entry point
import { render, h } from 'preact';
import { EventBus } from './eventBus.js';
import { SoundManager } from './SoundManager.js';
import { InputManager } from './InputManager.js';
import { GameController } from './GameController.js';
import { App } from './ui/App.jsx';

const eventBus = new EventBus();
const sound = new SoundManager();
const input = new InputManager(eventBus);
const game = new GameController(eventBus, sound, input);

render(h(App, null), document.getElementById('ui-root'));

game.init();
