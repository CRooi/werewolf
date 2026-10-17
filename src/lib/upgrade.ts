/**
 * 后端更新检测：后端每次启动有一个 bootId，连上时下发。
 * 断线重连后发现 bootId 变了，说明后端更新部署过，带上 upgraded 参数刷新页面换上新版前端，
 * 刷新后由本地保存的会话自动回到原房间。
 */

/** 页面是不是因为后端更新后自动刷新而打开的 */
export const justUpgraded = new URLSearchParams(location.search).has('upgraded')

let serverBoot: string | null = null

/** 收到后端的 bootId；需要刷新页面时返回 true，调用方应停止重连 */
export function checkServerBoot(bootId: string): boolean {
  if (serverBoot && serverBoot !== bootId) {
    const url = new URL(location.href)
    url.searchParams.set('upgraded', '1')
    location.replace(url)
    return true
  }
  serverBoot = bootId
  return false
}

/** 更新提示展示过后去掉 URL 上的 upgraded 参数，免得手动刷新时又提示一次 */
export function clearUpgradedParam() {
  const url = new URL(location.href)
  if (!url.searchParams.has('upgraded')) return
  url.searchParams.delete('upgraded')
  history.replaceState(null, '', url)
}
