import { EVT } from './EVT'
import { theme } from './Theme'
import { Colors } from './Colors'
import { bg } from './BG'
import { lang } from './Lang'
import { store } from './store/Store'
import { toast } from './Toast'
import { Tools } from './Tools'
import { Utils } from './utils/Utils'
import { settings } from './setting/Settings'
import { DateFormat } from './utils/DateFormat'
import { Config } from './Config'

// 日志
class Log {
  constructor() {
    this.scrollToBottom()

    window.addEventListener(EVT.list.clearLog, () => {
      this.clear()
    })

    const clearRecordEvents = [EVT.list.clearLog, EVT.list.downloadStop]
    clearRecordEvents.forEach((evt) => {
      window.addEventListener(evt, () => {
        this.record = []
      })
    })

    window.addEventListener(EVT.list.crawlComplete, () => {
      if (settings.exportLog && settings.exportLogTiming === 'crawlComplete') {
        this.export()
      }
    })

    window.addEventListener(EVT.list.downloadComplete, () => {
      if (
        settings.exportLog &&
        settings.exportLogTiming === 'downloadComplete'
      ) {
        this.export()
      }
    })
  }

  private id = 'logWrap' // 日志区域元素的 id
  private wrap = document.createElement('div') // 日志容器的区域
  private logArea = document.createElement('div') // 日志主体区域
  private refresh = document.createElement('span') // 刷新时使用的元素
  private readonly levelColor = [
    'inherit',
    Colors.textSuccess,
    Colors.textWarning,
    Colors.textError,
  ]

  private max = 300
  private count = 0

  private record: { html: string; level: number }[] = []

  private toBottom = false // 指示是否需要把日志滚动到底部。当有日志被添加或刷新，则为 true。滚动到底部之后复位到 false，避免一直滚动到底部。

  // 添加日志
  /*
  str 日志文本
  level 日志等级
  br 换行标签的个数
  keepShow 追加日志的模式，默认为 true，把这一条日志添加后不再修改。false 则是刷新显示这条消息。

  level 日志等级：
  0 normal
  1 success
  2 warning
  3 error
  */
  private add(str: string, level: number, br: number, keepShow: boolean) {
    this.checkElement()
    let span = document.createElement('span')
    if (!keepShow) {
      span = this.refresh
    } else {
      this.count++
    }

    span.innerHTML = str

    span.style.color = this.levelColor[level]

    while (br > 0) {
      span.appendChild(document.createElement('br'))
      br--
    }

    this.logArea.appendChild(span)
    this.toBottom = true // 需要把日志滚动到底部

    // 把持久日志保存到记录里
    if (keepShow) {
      this.record.push({ html: span.outerHTML, level })
    }
  }

  public log(str: string, br: number = 1, keepShow: boolean = true) {
    this.add(str, 0, br, keepShow)
  }

  public success(str: string, br: number = 1, keepShow: boolean = true) {
    this.add(str, 1, br, keepShow)
  }

  public warning(str: string, br: number = 1, keepShow: boolean = true) {
    this.add(str, 2, br, keepShow)
  }

  public error(str: string, br: number = 1, keepShow: boolean = true) {
    this.add(str, 3, br, keepShow)
  }

  /**将刷新的日志元素持久化 */
  // 刷新区域通常用于显示进度，例如 0/10, 1/10, 2/10... 10/10
  // 它们使用同一个 span 元素，并且同时只能存在一个刷新区域
  // 当显示 10/10 的时候，进度就不会再变化了，此时应该将其“持久化”。生成一个新的 span 元素作为新的刷新区域
  // 这样如果后续又需要显示刷新的元素，不会影响之前已完成“持久化”的日志
  public persistentRefresh() {
    this.refresh = document.createElement('span')
  }

  private checkElement() {
    // 如果日志区域没有被添加到页面上，则添加
    let test = document.getElementById(this.id)
    if (test === null) {
      this.wrap = document.createElement('div')
      this.wrap.id = this.id
      this.logArea = document.createElement('div')
      this.logArea.classList.add('beautify_scrollbar', 'logContent')
      if (Config.mobile) {
        this.wrap.classList.add('mobile')
      }
      this.wrap.append(this.logArea)
      document.body.insertAdjacentElement('beforebegin', this.wrap)
      theme.register(this.wrap)
      // 虽然可以应用背景图片，但是由于日志区域比较狭长，背景图片的视觉效果不佳，看起来比较粗糙，所以还是不应用背景图片了
      // bg.useBG(this.wrap, 0.9)
    }

    // 如果页面上的日志条数超过指定数量，则清空
    // 因为日志数量太多的话会占用很大的内存。同时显示 8000 条日志可能占用接近 1 GB 的内存
    if (this.count > this.max) {
      this.clear()
    }
  }

  /**移除日志区域 */
  public remove() {
    this.count = 0
    this.wrap.remove()
  }

  /**清空显示的日志内容 */
  public clear() {
    this.count = 0
    this.logArea.innerHTML = ''
  }

  // 因为日志区域限制了最大高度，可能会出现滚动条，这里使日志总是滚动到底部
  private scrollToBottom() {
    window.setInterval(() => {
      if (this.toBottom) {
        this.logArea.scrollTop = this.logArea.scrollHeight
        this.toBottom = false
      }
    }, 800)
  }

  private export() {
    const data: string[] = []

    for (const record of this.record) {
      let html = ''
      if (record.level !== 3 && settings.exportLogNormal) {
        html = record.html
      }
      if (record.level === 3 && settings.exportLogError) {
        html = record.html
      }

      // 检查排除的关键字
      if (html && settings.exportLogExclude.length > 0) {
        let checkStr = html
        // 如果含有作品链接，则只检查链接后面的部分。这是为了避免因作品 id 中包含要排除的关键字而导致错误的排除
        if (html.includes('<a href')) {
          const array = html.split('</a>')
          checkStr = array[array.length - 1]
        }
        const index = settings.exportLogExclude.findIndex((val) => {
          return checkStr.includes(val)
        })
        if (index === -1) {
          data.push(html)
        }
      }
    }

    if (data.length === 0) {
      return
    }

    const fileName = `log-${Utils.replaceUnsafeStr(
      Tools.getPageTitle()
    )}-${Utils.replaceUnsafeStr(
      DateFormat.format(store.crawlCompleteTime, settings.dateFormat)
    )}.html`

    const content = `<!DOCTYPE html>
<html>
<body>
<div id="logWrap">
${data.join('\n')}
</div>
</body>
</html>`

    const blob = new Blob([content], {
      type: 'text/html',
    })

    const url = URL.createObjectURL(blob)

    Utils.downloadFile(url, fileName)

    const msg = lang.transl('_导出日志成功')
    log.success(msg)
    toast.success(msg, {
      position: 'topCenter',
    })
  }
}

const log = new Log()
export { log }
