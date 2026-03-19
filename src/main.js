// Main game entry point
import { EventBus } from './eventBus.js';
import { SoundManager } from './SoundManager.js';
import { InputManager } from './InputManager.js';
import { UIManager } from './UIManager.js';
import { GameController } from './GameController.js';

const eventBus = new EventBus();
const sound = new SoundManager();
const input = new InputManager(eventBus);
const ui = new UIManager(eventBus);
const game = new GameController(eventBus, sound, input, ui);

game.init();
