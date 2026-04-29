import PDFDocument from 'pdfkit';
import { Buffer } from 'buffer';
import fs from 'fs';
import type { ParsedScript, ScriptLine, Token } from 'aw-parser';
type PrintElement = { feed?: number; color?: string; italic?: boolean };
import { versionGenerator, blankText, getIndentation } from './helper';
import { PrintProfile } from './print-profile';

export interface PdfConfig {
	fonts?: { regular: string; bold: string; bolditalic: string; italic: string };
	print_title_page: boolean;
	print_header: string;
	print_footer: string;
	print_watermark: string;
	scene_continuation_top: boolean;
	scene_continuation_bottom: boolean;
	show_page_numbers: boolean;
	embolden_scene_headers: boolean;
	underline_scene_headers: boolean;
	number_sections: boolean;
	scenes_numbers: 'none' | 'left' | 'right' | 'both';
	text_scene_continued?: string;
}

export interface PdfOpts {
	parsed: ParsedScript;
	print: PrintProfile;
	config: PdfConfig;
	filepath: string;
	callback: () => void;
	hooks?: { before_script?: (doc: FountainPDFDocument) => void };
}

interface FormatState {
	bold: boolean;
	italic: boolean;
	underline: boolean;
	override_color: string | null;
}

interface FountainTextOptions extends PDFKit.Mixins.TextOptions {
	color?: string;
	line_break?: boolean;
}

interface SimpleStreamLike {
	chunks: Buffer[];
	filepath: string;
	callback?: () => void;
	on(event: string, cb: () => void): void;
	once(): void;
	emit(): void;
	write(chunk: Buffer): void;
	end(): void;
}

class FountainPDFDocument extends PDFDocument {
	format_state: FormatState = {
		bold: false,
		italic: false,
		underline: false,
		override_color: null,
	};
	private readonly profile: PrintProfile;

	constructor(opts: PdfOpts) {
		const { print, config } = opts;
		super({
			compress: false,
			size: print.paper_size === 'a4' ? 'A4' : 'LETTER',
			margins: { top: 0, left: 0, bottom: 0, right: 0 },
			// Prevent initFonts from loading Helvetica AFM via the broken __dirname.
			// We register Courier immediately below, so Helvetica is never needed.
			font: 'Courier',
		});
		this.profile = print;

		const fonts = config.fonts ?? null;
		if (fonts) {
			this.registerFont('ScriptNormal', fonts.regular);
			this.registerFont('ScriptBold', fonts.bold);
			this.registerFont('ScriptBoldOblique', fonts.bolditalic);
			this.registerFont('ScriptOblique', fonts.italic);
		} else {
			this.registerFont('ScriptNormal', 'Courier');
			this.registerFont('ScriptBold', 'Courier-Bold');
			this.registerFont('ScriptBoldOblique', 'Courier-BoldOblique');
			this.registerFont('ScriptOblique', 'Courier-Oblique');
		}

		this.font('ScriptNormal');
		this.fontSize(print.font_size ?? 12);
		this.reset_format();
	}

	reset_format(): void {
		this.format_state = { bold: false, italic: false, underline: false, override_color: null };
	}

	// Renders text at pre-multiplied point coordinates, bypassing inline formatting.
	simple_text(text: string, x: number, y: number): this {
		this.font('ScriptNormal');
		return super.text(text, x, y);
	}

	// Renders text at inch coordinates via the formatting-aware text() override,
	// but resets format_state so no inherited bold/italic/color bleeds through.
	format_text(text: string, x: number, y: number, options?: FountainTextOptions): this {
		const savedState = { ...this.format_state };
		this.reset_format();
		this.text(text, x, y, options);
		this.format_state = savedState;
		return this;
	}

	// Parses Fountain inline markup (*bold*, _underline_, [[notes]]) and renders
	// each segment via super.text() at explicit point coordinates (inches × 72).
	// Signature covers both PDFDocument overloads: text(text, x?, y?, opts?) and text(text, opts?).
	override text(text: string, x?: number | FountainTextOptions, y?: number, options?: FountainTextOptions): this {
		const resolvedX = typeof x === 'number' ? x : undefined;
		const opts: FountainTextOptions = (typeof x === 'object' ? x : options) ?? {};
		let color: string = opts.color ?? 'black';
		color = this.format_state.override_color ?? color;

		this.fill(color);

		let mutableText = text;
		if (this.profile.note.italic) {
			mutableText = mutableText.replace(/\[\[/g, '*[[').replace(/\]\]/g, ']]*');
		}

		const segments: string[] = mutableText
			.split(/(\\\*)|(\*{1,3})|(\\?_)|(\[\[)|(\]\])/g)
			.filter((a): a is string => !!a);

		const fontWidth = this.profile.font_width;
		let posX = resolvedX ?? 0;
		const posY = y ?? 0;

		for (const elem of segments) {
			if (elem === '***') {
				this.format_state.italic = !this.format_state.italic;
				this.format_state.bold = !this.format_state.bold;
			} else if (elem === '**') {
				this.format_state.bold = !this.format_state.bold;
			} else if (elem === '*') {
				this.format_state.italic = !this.format_state.italic;
			} else if (elem === '_') {
				this.format_state.underline = !this.format_state.underline;
			} else if (elem === '[[') {
				this.format_state.override_color = this.profile.note.color || '#000000';
				this.fill(this.format_state.override_color);
			} else if (elem === ']]') {
				this.format_state.override_color = null;
				this.fill('black');
			} else {
				if (this.format_state.bold && this.format_state.italic) {
					this.font('ScriptBoldOblique');
				} else if (this.format_state.bold) {
					this.font('ScriptBold');
				} else if (this.format_state.italic) {
					this.font('ScriptOblique');
				} else {
					this.font('ScriptNormal');
				}
				let elemText = elem;
				if (elemText === '\\_' || elemText === '\\*') {
					elemText = elemText.slice(1, 2);
				}
				super.text(elemText, posX * 72, posY * 72, {
					underline: this.format_state.underline,
					lineBreak: opts.line_break,
				});
				posX += fontWidth * elemText.length;
			}
		}

		return this;
	}
}

function createSimpleStream(filepath: string): SimpleStreamLike {
	const simplestream: SimpleStreamLike = {
		chunks: [],
		filepath,
		on(_event: string, callback: () => void) {
			this.callback = callback;
		},
		once() {},
		emit() {},
		write(chunk: Buffer) {
			this.chunks.push(chunk);
		},
		end() {
			const stream = fs.createWriteStream(simplestream.filepath, { encoding: 'binary' });
			stream.on('finish', this.callback!);
			simplestream.chunks.forEach(function (buffer: Buffer) {
				stream.write(Buffer.from(buffer.toString('base64'), 'base64'));
			});
			stream.end();
		},
	};
	return simplestream;
}

function clearFormatting(text: string): string {
	return text.replace(/\*/g, '').replace(/_/g, '');
}

function inline(text: string): string {
	return text.replace(/\n/g, ' ');
}

function finishDoc(doc: FountainPDFDocument, callback: () => void, filepath: string): void {
	const simpleStream = createSimpleStream(filepath);
	doc.pipe(simpleStream as unknown as NodeJS.WritableStream);
	doc.end();
	simpleStream.on('finish', callback);
}

const getTitlePageToken = function (parsed: ParsedScript | undefined, type?: string): Token | null {
	if (!type || !parsed) return null;
	let result: Token | null = null;
	parsed.title_page.forEach(function (token: Token) {
		if (token.is(type)) {
			result = token;
		}
	});
	return result;
};

function generate(doc: FountainPDFDocument, opts: PdfOpts): void {
	const parsed = opts.parsed;
	const cfg = opts.config;
	const print = opts.print;
	const lines = parsed.lines;

	const title_token = getTitlePageToken(parsed, 'title');
	let author_token = getTitlePageToken(parsed, 'author');
	if (!author_token) {
		author_token = getTitlePageToken(parsed, 'authors');
	}

	doc.info.Title = title_token ? clearFormatting(inline(title_token.text)) : '';
	doc.info.Author = author_token ? clearFormatting(inline(author_token.text)) : '';
	doc.info.Creator = 'afterwriting.com';

	const center = function (txt: string, y: number) {
		const txt_length = txt.replace(/\*/g, '').replace(/_/g, '').length;
		const feed = (print.page_width - txt_length * print.font_width) / 2;
		doc.text(txt, feed, y);
	};

	let title_y = print.title_page.top_start;

	const title_page_next_line = function () {
		title_y += print.line_spacing * print.font_height;
	};

	const title_page_main = function (parsed?: ParsedScript, type?: string, options?: { capitalize?: boolean }) {
		options = options || {};
		if (arguments.length === 0) {
			title_page_next_line();
			return;
		}
		const token = getTitlePageToken(parsed, type);
		if (token) {
			token.text.split('\n').forEach(function (line: string) {
				if (options.capitalize) {
					line = line.toUpperCase();
				}
				center(line, title_y);
				title_page_next_line();
			});
		}
	};

	if (cfg.print_title_page) {
		title_page_main(parsed, 'title', { capitalize: true });
		title_page_main();
		title_page_main();
		title_page_main(parsed, 'credit');
		title_page_main();
		title_page_main(parsed, 'author');
		title_page_main();
		title_page_main();
		title_page_main();
		title_page_main();
		title_page_main(parsed, 'source');

		const concat_types = function (parsed: ParsedScript, prev: string[], type: string) {
			const token = getTitlePageToken(parsed, type);
			if (token) {
				prev = prev.concat(token.text.split('\n'));
			}
			return prev;
		};

		const left_side: string[] = print.title_page.left_side.reduce(
			concat_types.bind(null, parsed),
			[] as string[]
		);
		const right_side: string[] = print.title_page.right_side.reduce(
			concat_types.bind(null, parsed),
			[] as string[]
		);

		const title_page_extra = function (x: number) {
			return function (line: string) {
				doc.text(line.trim(), x, title_y);
				title_page_next_line();
			};
		};

		title_y = 8.5;
		left_side.forEach(title_page_extra(1.3));

		title_y = 8.5;
		right_side.forEach(title_page_extra(5));

		doc.addPage();
	}

	if (opts.hooks?.before_script) {
		opts.hooks.before_script(doc);
	}

	let y = 0;
	let page = 1;
	let scene_number: string | undefined;
	let prev_scene_continuation_header = '';
	const scene_continuations: Record<string, number> = {};
	let current_section_level = 0;
	let current_section_number: string | undefined;
	let current_section_token: Token | undefined;
	const section_number = versionGenerator();
	let text: string;
	let after_section = false;

	const print_header_and_footer = function (continuation_header?: string) {
		if (cfg.print_header) {
			continuation_header = continuation_header || '';
			let offset = blankText(continuation_header);
			if (getIndentation(cfg.print_header).length >= continuation_header.length) {
				offset = '';
			}
			if (offset) {
				offset += ' ';
			}
			doc.format_text(offset + cfg.print_header, 1.5, print.page_number_top_margin, {
				color: '#777777',
			});
		}
		if (cfg.print_footer) {
			doc.format_text(cfg.print_footer, 1.5, print.page_height - 0.5, {
				color: '#777777',
			});
		}
	};

	const print_watermark = function () {
		if (cfg.print_watermark) {
			const options = { origin: [0, 0] };
			const watermark = cfg.print_watermark.replace(/_/g, '');
			const len = watermark.replace(/\*/g, '').length;
			const diagonal =
				Math.sqrt(Math.pow(print.page_width, 2) + Math.pow(print.page_height, 2)) - 4;
			const angle = (Math.atan(print.page_height / print.page_width) * 180) / Math.PI;
			const font_size = ((1.667 * diagonal) / len) * 72;
			doc.fontSize(font_size);
			doc.rotate(angle, options);
			doc.format_text(watermark, 2, -(font_size / 2) / 72, {
				color: '#eeeeee',
				line_break: false,
			});
			doc.rotate(-angle, options);
			doc.fontSize(print.font_size ?? 12);
		}
	};

	print_watermark();
	print_header_and_footer();

	lines.forEach(function (line: ScriptLine) {
		if (line.type === 'page_break') {
			if (cfg.scene_continuation_bottom && line.scene_split) {
				const scene_continued_text =
					'(' + (cfg.text_scene_continued || 'CONTINUED') + ')';
				const feed =
					print.action.feed +
					print.action.max * print.font_width -
					scene_continued_text.length * print.font_width;
				doc.simple_text(
					scene_continued_text,
					feed * 72,
					(print.top_margin + print.font_height * (y + 2)) * 72
				);
			}

			y = 0;
			doc.addPage();
			page++;

			const number_y = print.page_number_top_margin;

			if (cfg.scene_continuation_top && line.scene_split) {
				const key = scene_number!;
				scene_continuations[key] = scene_continuations[key] || 0;
				scene_continuations[key]++;

				let scene_continued =
					(cfg.scenes_numbers !== 'none' && scene_number ? scene_number + ' ' : '') +
					(cfg.text_scene_continued || 'CONTINUED') +
					':';
				scene_continued +=
					scene_continuations[key] > 1 ? ' (' + scene_continuations[key] + ')' : '';
				scene_continued = scene_continued.replace(/\*/g, '').replace(/_/g, '');
				doc.simple_text(scene_continued, print.action.feed * 72, number_y * 72);
				prev_scene_continuation_header = scene_continued;
			}

			if (cfg.show_page_numbers) {
				const page_num = page.toFixed() + '.';
				const number_x =
					print.action.feed +
					print.action.max * print.font_width -
					page_num.length * print.font_width;
				doc.simple_text(page_num, number_x * 72, number_y * 72);
			}
			print_watermark();
			print_header_and_footer(prev_scene_continuation_header);
			prev_scene_continuation_header = '';
		} else if (line.type === 'separator') {
			y++;
		} else {
			text = line.text;

			const lineTypePrint = print[line.type] as PrintElement | undefined;
			const color: string = lineTypePrint?.color ?? '#000000';
			const text_properties: FountainTextOptions = { color };

			if (line.type === 'centered') {
				center(text, print.top_margin + print.font_height * y++);
			} else {
				let feed: number = lineTypePrint?.feed ?? print.action.feed;

				if (line.type === 'transition') {
					feed =
						print.action.feed +
						print.action.max * print.font_width -
						line.text.length * print.font_width;
				}
				if (line.type === 'scene_heading' && cfg.embolden_scene_headers) {
					text = '**' + text + '**';
				}
				if (line.type === 'scene_heading' && cfg.underline_scene_headers) {
					text = '_' + text + '_';
				}

				if (line.type === 'section') {
					current_section_level = line.token.level ?? 0;
					feed += current_section_level * print.section.level_indent;
					if (cfg.number_sections) {
						if (line.token !== current_section_token) {
							current_section_number = section_number(line.token.level);
							current_section_token = line.token;
							text = current_section_number + '. ' + text;
						} else {
							text = Array(current_section_number!.length + 3).join(' ') + text;
						}
					}
				} else if (line.type === 'synopsis') {
					feed += print.synopsis.padding ?? 0;
					if (print.synopsis.feed_with_last_section && after_section) {
						feed += current_section_level * print.section.level_indent;
					} else {
						feed = print.action.feed;
					}
				}

				if (lineTypePrint?.italic && text) {
					text = '*' + text + '*';
				}

				if (line.token && line.token.dual) {
					if (line.right_column) {
						let y_right = y;
						line.right_column.forEach(function (dualLine: ScriptLine) {
							const dualPrint = print[dualLine.type] as PrintElement | undefined;
							let feed_right: number = dualPrint?.feed ?? print.action.feed;
							feed_right -= (feed_right - print.left_margin) / 2;
							feed_right +=
								(print.page_width - print.right_margin - print.left_margin) / 2;
							doc.text(
								dualLine.text,
								feed_right,
								print.top_margin + print.font_height * y_right++,
								text_properties
							);
						});
					}
					feed -= (feed - print.left_margin) / 2;
				}

				doc.text(text, feed, print.top_margin + print.font_height * y, text_properties);

				if (line.number) {
					scene_number = String(line.number);
					const scene_text_length = scene_number.length;
					let scene_num_display = scene_number;
					if (cfg.embolden_scene_headers) {
						scene_num_display = '**' + scene_num_display + '**';
					}
					if (cfg.underline_scene_headers) {
						scene_num_display = '_' + scene_num_display + '_';
					}

					if (cfg.scenes_numbers === 'both' || cfg.scenes_numbers === 'left') {
						const shift_left = (scene_text_length + 4) * print.font_width;
						doc.text(
							scene_num_display,
							feed - shift_left,
							print.top_margin + print.font_height * y,
							text_properties
						);
					}
					if (cfg.scenes_numbers === 'both' || cfg.scenes_numbers === 'right') {
						const shift_right = (print.scene_heading.max + 1) * print.font_width;
						doc.text(
							scene_num_display,
							feed + shift_right,
							print.top_margin + print.font_height * y,
							text_properties
						);
					}
				}

				y++;
			}
		}

		if (line.type === 'section') {
			after_section = true;
		} else if (
			line.type !== 'separator' &&
			line.type !== 'synopsis' &&
			line.type !== 'page_break'
		) {
			after_section = false;
		}
	});
}

export function get_pdf(opts: PdfOpts): void {
	const doc = new FountainPDFDocument(opts);
	generate(doc, opts);
	finishDoc(doc, opts.callback, opts.filepath);
}
