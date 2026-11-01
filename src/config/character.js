/**
 * 角色配置 —— 换角色基本只改这一个文件
 *
 * 这里放「会出现在界面上的角色相关文字」。台词和剧情不在这里，
 * 在 dialogue.js / stories.js。
 *
 * 想换成自己的角色：改下面几个字段就行，不用动页面代码。
 */

export const CHARACTER = {
  /** 角色名。聊天页、关于页、设置页会显示它。 */
  name: '小助手',

  /** 角色怎么称呼玩家（留空就用「你」）。 */
  playerName: '你',

  /** 应用显示名（关于页标题）。和 manifest.json 的 name 保持一致更自然。 */
  appName: '桌宠框架',

  /** 关于页副标题，一句话说明这是什么。 */
  tagline: '自备素材与文案的桌宠框架',

  /**
   * 角色头像。消息列表、关于页都用它。
   * 任意尺寸都行（显示时会等比缩放到容器里，不会变形）。
   */
  avatar: '/common/img/icon.png',

  /** 主页点一下时气泡里的初始提示语。 */
  tapHint: '点我一下嘛～',

  /** 聊天页对方思考时显示的提示。 */
  typingHint: '正在输入…',

  /**
   * 角色生日 [月, 日]，用来触发「今天是我生日」这类日期事件。
   * 填 null 就没有生日事件。
   */
  birthday: null,

  /**
   * 终章机制（可选）。
   * 好感度到 minAff 时，先强制冒出「彩蛋」那段（eggId），
   * 彩蛋玩完才放出最终消息（finalId）。两个 id 都填 stories.js 里的剧情 id。
   *
   * 不需要这个机制就把 eggId / finalId 留空字符串 —— 两段剧情会当普通剧情处理。
   * 注意：留空时 minAff 无效。
   */
  finale: {
    eggId: 'sample_egg',
    finalId: 'sample_final',
    minAff: 180
  }
}
