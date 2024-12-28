import { filter, FilterOption } from '../filter/Filter'
import { NovelData } from '../crawl/CrawlResult'
import { store } from './Store'
import { settings } from '../setting/Settings'
import { Tools } from '../Tools'
import { Utils } from '../utils/Utils'
import { DateFormat } from '../utils/DateFormat'

// 保存单个小说作品的数据
class SaveNovelData {
  public async save(data: NovelData) {
    // 小说没有 illustType 属性， 把小说的 illustType 设置为 3，这是为了方便检查
    const illustType = 3

    // 获取需要检查的信息
    const body = data.body
    const bmk = body.bookmarkCount // 收藏数

    const tags: string[] = Tools.extractTags(data) // tag 列表
    // 小说的标签没有进行翻译，所以没有翻译后的标签

    const aiMarkString = Tools.getAIGeneratedMark(body.aiType)
    if (aiMarkString) {
      tags.unshift(aiMarkString)
    }

    const filterOpt: FilterOption = {
      aiType: body.aiType,
      createDate: body.createDate,
      id: body.id,
      workType: illustType,
      tags: tags,
      bookmarkCount: bmk,
      bookmarkData: body.bookmarkData,
      userId: body.userId,
      xRestrict: body.xRestrict,
    }

    // 检查通过
    if (await filter.check(filterOpt)) {
      const id = body.id
      const idNum = parseInt(id)
      const title = body.title
      const userId = body.userId
      const user = body.userName
      const bookmarked = !!body.bookmarkData

      // 保存作品在排行榜上的编号
      const rankData = store.getRankList(id)
      const rank = rankData ? rankData : null

      // 系列标题和序号
      const seriesTitle = body.seriesNavData ? body.seriesNavData.title : ''
      const seriesOrder = body.seriesNavData ? body.seriesNavData.order : null

      // 保存小说的一些元数据
      let meta = ''
      let metaArr: string[] = []

      const pageUrl = `https://www.pixiv.net/novel/show.php?id=${id}`
      const tagsA = []
      for (const tag of tags) {
        tagsA.push('#' + tag)
      }
      // 这个 description 是保存到抓取结果里的，尽量保持原样，会保留 html 标签
      const description = Utils.htmlDecode(body.description)
      // metaDescription 保存在 novelMeta.description 和 novelMeta.meta 里
      // 它会在生成的小说里显示，供读者阅读，所以移除了 html 标签，只保留纯文本
      // 处理后，换行标记是 \n 而不是 <br/>
      const metaDescription = Tools.replaceEPUBDescription(
        Utils.htmlToText(description)
      )
      const date = DateFormat.format(body.createDate, settings.dateFormat)
      metaArr.push(
        title,
        user,
        pageUrl,
        date,
        metaDescription,
        tagsA.join('\n')
      )
      meta = metaArr.join('\n\n') + '\n\n\n'

      // 提取嵌入的图片资源
      let embeddedImages: null | {
        [key: string]: string
      } = null
      if (body.textEmbeddedImages) {
        embeddedImages = {}
        for (const [id, value] of Object.entries(body.textEmbeddedImages)) {
          embeddedImages[id] = value.urls.original
        }
      }

      // 保存作品信息

      store.addResult({
        aiType: body.aiType,
        id: id,
        idNum: idNum,
        thumb: body.coverUrl || undefined,
        title: title,
        description: description,
        tags: tags,
        tagsWithTransl: tags,
        tagsTranslOnly: tags,
        user: user,
        userId: userId,
        // 这里的 ext 并不重要，下载时会根据 novelSaveAs 设置自动生成对应的数据
        ext: settings.novelSaveAs,
        bmk: bmk,
        bmkId: body.bookmarkData ? body.bookmarkData.id : '',
        bookmarked: bookmarked,
        date: body.createDate,
        uploadDate: body.uploadDate,
        type: illustType,
        rank: rank,
        seriesTitle: seriesTitle,
        seriesOrder: seriesOrder,
        seriesId: body.seriesNavData ? body.seriesNavData!.seriesId : null,
        viewCount: body.viewCount,
        likeCount: body.likeCount,
        commentCount: body.commentCount,
        novelMeta: {
          id: body.id,
          title: title,
          content: this.replaceFlag(body.content),
          description: metaDescription,
          coverUrl: body.coverUrl,
          createDate: body.createDate,
          userName: body.userName,
          embeddedImages: embeddedImages,
          meta: meta,
          tags: tags,
        },
        xRestrict: body.xRestrict,
      })
    }
  }

  // '[[jumpuri:予約ページ>https://www.amazon.co.jp/dp/4758092486]]'
  // 替换成
  // '予約ページ（https://www.amazon.co.jp/dp/4758092486）'
  private replaceJumpuri(str: string) {
    let reg = /\[\[jumpuri:(.*?)>(.*?)\]\]/g
    let temp
    while ((temp = reg.exec(str))) {
      str = str.replace(temp[0], `${temp[1].trim()}（${temp[2].trim()}）`)
      reg.lastIndex = 0
    }

    return str
  }

  // > '[[rb:莉莉丝 > Lilith]]'
  // 替换成
  // '莉莉丝（Lilith）'
  private replaceRb(str: string) {
    let reg = /\[\[rb:(.*?)>(.*?)\]\]/g
    let temp
    while ((temp = reg.exec(str))) {
      str = str.replace(temp[0], `${temp[1].trim()}（${temp[2].trim()}）`)
      reg.lastIndex = 0
    }
    return str
  }

  // > '[chapter:标题]'
  // 替换成
  // '标题'
  private replaceChapter(str: string) {
    const reg = /\[chapter:(.*?)\]/g
    let temp
    while ((temp = reg.exec(str))) {
      str = str.replace(temp[0], temp[1])
      reg.lastIndex = 0
    }
    return str
  }

  // 对小说里的一些标记进行替换
  private replaceFlag(str: string) {
    str = str.replace(/\[newpage\]/g, '')

    str = this.replaceJumpuri(str)

    str = str.replace(/\[jump:.*?\]/g, '')

    str = this.replaceRb(str)

    str = this.replaceChapter(str)

    return str
  }
}

const saveNovelData = new SaveNovelData()
export { saveNovelData }
