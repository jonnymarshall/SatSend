"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface Props {
  uri: string;
  size?: number;
}

export function BtcQrCode({ uri, size = 240 }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(uri, {
      width: size,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    }).then(setDataUrl);
  }, [uri, size]);

  if (!dataUrl) {
    return (
      <div
        className="animate-pulse rounded-(--radius-sm) bg-(--color-neutral-soft)"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <img
      src={dataUrl}
      alt="Bitcoin payment QR code"
      width={size}
      height={size}
      className="rounded"
    />
  );
}
