/**
 * 手書き風のアイコン。絵文字だと環境差が大きく、線の表情も出ないため
 * SVGで描く。わずかに歪ませたパスで、ペンでなぞった感じにしている。
 */
export function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* レンズ。真円にせず、線を一周させて始点と終点をわずかにずらす */}
      <path d="M15.6 10.2c.1 3.1-2.3 5.7-5.3 5.8-3.1.1-5.7-2.2-5.9-5.2-.1-3.1 2.2-5.7 5.3-5.9 3-.1 5.6 2.1 5.8 5.1" />
      {/* 取っ手。少し波打たせる */}
      <path d="M14.3 14.6c1.5 1.6 3 3.2 4.4 4.9" />
      {/* レンズの光。手書きらしさを出す短い線 */}
      <path d="M7.4 8.6c.5-1.1 1.5-1.9 2.7-2.1" opacity=".55" />
    </svg>
  )
}
