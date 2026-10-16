// Design tokens de FidelityPass — paleta v2 (identidad-de-marca.md)
// REGLA: ningún módulo hardcodea colores; todo importa de acá.

export const colors = {
  azulNoche: "#0A2540",
  celesteBandera: "#74ACDF",
  dorado: "#E3A72F",
  niebla: "#F5F7FA",
  pizarra: "#334155",
} as const;

export type ColorName = keyof typeof colors;

export const theme = {
  colors,
  surface: {
    primary: colors.azulNoche, // superficies principales
    light: colors.niebla, // fondos claros
  },
  text: {
    onDark: colors.niebla, // texto sobre superficies oscuras
    onLight: colors.azulNoche, // texto sobre fondos claros
    secondary: colors.pizarra, // texto secundario
  },
  button: {
    primaryBg: colors.celesteBandera, // botones primarios: fondo celeste...
    primaryText: colors.azulNoche, // ...con texto azul noche
  },
  accent: {
    premium: colors.dorado, // solo detalles premium, nunca fondos grandes
  },
} as const;

export type Theme = typeof theme;
