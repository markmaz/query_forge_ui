// const images = import.meta.glob(
//   "/assets/images/**/*.{png,jpg,jpeg,svg,gif,webp}",
//   { eager: true, as: "url" }
// );

export function dynamicImage(image: string): string {
  const path = `/assets/images/${image}`;
  return path;
}

// dynamic number (this part was fine)
export function dynamicNumber(totalLength: number) {
  return Array.from({ length: totalLength }, (_, index) => index + 1);
}
