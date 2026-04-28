import { Plugin, TFile, Notice } from 'obsidian';
import { preprocessFountain } from '../fountain/preprocessor';
import { showSaveDialog } from './dialog';
import { exportFountain } from './pipeline';

export async function runExport(plugin: Plugin, file: TFile): Promise<void> {
	const text = await plugin.app.vault.read(file);
	const basename = file.basename;
	const processed = preprocessFountain(text, basename);

	const outputPath = await showSaveDialog(basename + '.pdf');
	if (outputPath === null) return;

	try {
		await exportFountain(processed, outputPath);
	} catch (err) {
		console.error('Fountain Export failed:', err);
		new Notice('Fountain Export failed. See console for details.');
	}
}
