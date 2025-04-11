const themes = {
	purple: {
		light: [
			['--mainColor', '#ffffff'],
			['--secColor', '#2c2c2c'],
			['--terColor', '#ebe6ff'],
			['--quatColor', '#dcd3ff'],
			['--shadowColor', '#2c2c2c20']
		],
		dark: [
			['--mainColor', '#2c2c2c'],
			['--secColor', '#ffffff'],
			['--terColor', '#49445b'],
			['--quatColor', '#413d4f'],
			['--shadowColor', '#0000003a']
		]
	},
	blue: {
		light: [
			['--mainColor', '#ffffff'],
			['--secColor', '#2c2c2c'],
			['--terColor', '#adb6e1'],
			['--quatColor', '#c5cced'],
			['--shadowColor', '#2c2c2c20']
		],
		dark: [
			['--mainColor', '#2c2c2c'],
			['--secColor', '#ffffff'],
			['--terColor', '#44495b'],
			['--quatColor', '#3d404f'],
			['--shadowColor', '#0000003a']
		]
	},
	redorange: {
		light: [
			['--mainColor', '#ffffff'],
			['--secColor', '#2c2c2c'],
			['--terColor', '#ffe0d4'],
			['--quatColor', '#ffc5af'],
			['--shadowColor', '#2c2c2c20']
		],
		dark: [
			['--mainColor', '#2c2c2c'],
			['--secColor', '#ffffff'],
			['--terColor', '#673e2e'],
			['--quatColor', '#533225'],
			['--shadowColor', '#0000003a']
		]
	},
}

const nextMapThemeColor = {
	purple: 'blue',
	blue: 'redorange',
	redorange: 'purple',
}

const nextMapThemeBrightness = {
	light: 'dark',
	dark: 'system',
	system: 'light'
}

const symbolMapThemeBrightness = {
	light: 'light_mode',
	dark: 'dark_mode',
	system: 'contrast'
}

export {themes, nextMapThemeColor, nextMapThemeBrightness, symbolMapThemeBrightness}