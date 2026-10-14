// The font every 3D label (nameplates, action badges, equity badges) uses.
//
// Served from the app itself rather than the text renderer's default, which
// downloads a font from Google on first use: that fails offline (a poker
// night without internet) and is blocked by the shared proxy's policy.
// Lato is licensed under the SIL Open Font License; see public/fonts.
export const LABEL_FONT_URL = `${import.meta.env.BASE_URL}fonts/Lato-Bold.ttf`;
