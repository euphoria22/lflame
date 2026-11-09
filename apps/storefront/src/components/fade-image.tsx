"use client"

import Image, { type ImageProps } from "next/image"
import { useState } from "react"

/** next/image, которое плавно проявляется после загрузки (вместо резкого появления). */
export function FadeImage({ className = "", onLoad, alt, ...props }: ImageProps) {
  const [loaded, setLoaded] = useState(false)
  // Первые фото экрана (priority) показываем сразу — не тормозим первую отрисовку
  if (props.priority) return <Image {...props} alt={alt} className={className} onLoad={onLoad} />
  return (
    <Image
      {...props}
      alt={alt}
      className={`img-fade ${className}`}
      data-loaded={loaded}
      onLoad={(e) => { setLoaded(true); onLoad?.(e) }}
    />
  )
}
