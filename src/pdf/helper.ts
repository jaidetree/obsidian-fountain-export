export function versionGenerator(current?: string): (level?: number) => string {
	const seed = current || '0';
	const numbers: number[] = seed.split('.').map(Number).concat([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

	const bump = function (level: number) {
		numbers[level - 1]! += 1;
		for (let i = level; i < numbers.length; i++) {
			numbers[i] = 0;
		}
	};

	const toString = function () {
		const copy = numbers.slice();
		copy.reverse();
		while (copy.length > 1 && copy[0] === 0) {
			copy.shift();
		}
		copy.reverse();
		return copy.join('.');
	};

	return function (level?: number): string {
		if (level === undefined) {
			return toString();
		}
		bump(level);
		return toString();
	};
}

export function blankText(text: string): string {
	return (text || '').replace(/./g, ' ');
}

export function getIndentation(text: string): string {
	const match = (text || '').match(/^(\s+)/);
	return match ? match[0] : '';
}
