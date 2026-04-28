export function preprocessFountain(text: string, basename: string): string {
	// Strip Obsidian YAML frontmatter (--- ... ---)
	const fmMatch = text.match(/^---\r?\n[\s\S]*?\n---[ \t]*(\r?\n|$)/);
	if (fmMatch) {
		text = text.slice(fmMatch[0].length);
	}

	// Drop any leading blank lines left after stripping
	text = text.replace(/^(\r?\n)+/, '');

	return `title: ${basename}\n\n${text}`;
}
