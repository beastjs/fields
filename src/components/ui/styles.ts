// Tailwind class strings shared by several playground components.

export const primaryButton =
  'px-[13px] py-2 rounded-[4px] text-[11px] font-semibold border border-brand bg-brand text-[#1b1b1b] hover:bg-brand-hover light:rounded-lg light:border-brand light:text-white light:shadow-elevation'
export const secondaryButton =
  'px-[13px] py-2 rounded-[4px] text-[11px] border border-edge bg-control text-fg hover:bg-edge light:rounded-lg light:border-transparent light:bg-panel light:shadow-elevation light:hover:bg-surface-hover'
export const eyebrowLabel = 'font-code text-[9px] text-dim tracking-[0.15em]'
export const iconButton =
  'flex size-[26px] items-center justify-center rounded-[4px] bg-transparent text-[18px] text-dim hover:bg-edge hover:text-fg light:rounded-md light:hover:bg-control'
export const statusDot = 'inline-block size-[5px] shrink-0 rounded-full bg-brand shadow-[0_0_8px_#ff641b18]'

export const dialogPanel =
  'm-auto w-[min(540px,calc(100vw-24px))] max-h-[calc(100dvh-32px)] overflow-auto p-6 text-fg bg-panel border border-edge-strong rounded-[7px] shadow-[0_24px_80px_#0006] backdrop:bg-[#111b] backdrop:backdrop-blur-[4px] light:rounded-2xl light:border-edge light:shadow-[0_0_0_1px_rgb(17_17_19/0.04),0_24px_64px_-16px_rgb(17_17_19/0.22)] light:backdrop:bg-[#18181b2e]'
export const dialogHeading = 'flex items-start justify-between mb-3'
export const dialogTitle = 'mt-1 text-[21px] font-medium tracking-[-0.5px]'
export const dialogActions = 'flex justify-end gap-[7px] pt-[15px] border-t border-edge-strong'
export const transferDescription = 'mb-[18px] text-[12px] text-fg-secondary'
export const transferLabel = 'block mb-2 text-[11px]'
export const transferNote = 'my-3 text-[10px] leading-[1.7] text-dim [overflow-wrap:anywhere]'
export const sharedFiles = 'max-h-[min(300px,40dvh)] overflow-auto border border-edge rounded-[4px] bg-surface-recessed'
export const sharedFile =
  'border-b border-edge last:border-b-0 [&>summary]:px-3 [&>summary]:py-2.5 [&>summary]:cursor-pointer [&>summary]:font-code [&>summary]:text-[10px] [&>summary]:[overflow-wrap:anywhere] [&>pre]:m-0 [&>pre]:p-3 [&>pre]:overflow-auto [&>pre]:max-h-[200px] [&>pre]:font-code [&>pre]:text-[10px]/[1.7] [&>pre]:bg-inset [&>p]:px-3'
