import { Plugin } from 'obsidian';
import { registerCommands } from './commands';
import { registerMenus } from './menus';

export default class FountainExportPlugin extends Plugin {
	async onload() {
		registerCommands(this);
		registerMenus(this);
	}

	onunload() {}
}
