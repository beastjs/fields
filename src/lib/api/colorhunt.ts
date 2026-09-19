// const hexString = '425b9a76c0ecfff6dcff95a5'

export const toHex = (hexStr: string) => {
  const colors = []
  for (let i = 0; i < hexStr.length; i += 6) {
    colors.push('#' + hexStr.slice(i, i + 6).toUpperCase())
  }
  console.log(colors)
}

export type Code = {
  code: string
  likes: string
  date: string
}

// POST https://colorhunt.co/php/feed.php
// 40 items in response
