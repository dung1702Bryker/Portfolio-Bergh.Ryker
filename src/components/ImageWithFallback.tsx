import React from "react";
import { LazyImage, LazyImageProps } from "./LazyImage";

export interface ImageWithFallbackProps extends LazyImageProps {
  widths?: number[];
}

/**
 * ImageWithFallback wraps LazyImage to ensure all album collections,
 * carousels, and scrollytelling grids utilize IntersectionObserver with rootMargin: '200px'
 * for optimized lazy-loading and mobile data preservation.
 */
export const ImageWithFallback: React.FC<ImageWithFallbackProps> = React.memo((props) => {
  return <LazyImage {...props} />;
});

ImageWithFallback.displayName = "ImageWithFallback";
