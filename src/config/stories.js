/**
 * 剧情库（galgame 式分支对话）
 * ===============================================================
 * 一段剧情 = 一串「她说一句 → 你选一个 → 她再说」的往返，
 * 最后按累计的 score 结算三种结局之一。消息中心里可以重玩。
 *
 * ── 一个 story 对象的字段 ──────────────────────────────────────
 *   id      唯一标识。**存储用，定了就别改**（改了老存档对不上）
 *   title   消息列表里显示的标题
 *   icon    头像用的表情名，对应 common/emoji/<icon>_0.png
 *           （必须在 config/emoji.js 的 EMOJI 里）
 *   slots   可触发的时段数组：dawn / morning / noon / afternoon /
 *           evening / night / late（划分见 inbox.js 的 slotOf）
 *           留空数组 = 不按时段触发
 *   dates   日期事件数组（可选）：weekend / birthday / xmas / chunjie …
 *           和 config/dates.js 的 eventsOf() 返回值对应。
 *           带 dates 的剧情只在对应日期被自动触发，平时仍可手动重玩
 *   minAff  好感度门槛（可选）：不够时不会自动触发，也不进候选池
 *   start   起始 step 的 id
 *   steps   { stepId: {...} } 分支节点表
 *   endings { good, normal, bad } 三种结局
 *
 * ── step 的三种形态 ────────────────────────────────────────────
 *   1) { say: [...], next: '下一个' }   —— 说完自动跳转
 *   2) { say: [...], choices: [...] }   —— 说完弹出选项等玩家选
 *   3) { say: [...], finish: true }     —— 说完结算结局
 *
 * ── choice 的字段 ──────────────────────────────────────────────
 *   text    选项文字
 *   next    选完跳到哪个 step
 *   score   累加分：总分 >= 2 好结局，<= -1 坏结局，其余普通结局
 *           （阈值写死在 pages/chat/chat.ux，想改去那边改）
 *
 * ── 两个可选标记 ──────────────────────────────────────────────
 *   noSticker: true   这条对话不贴表情（适合严肃 / 打破第四面墙的内容）
 *   noReward:  true   玩完不加好感度（彩蛋、终章这类不该反复刷分的）
 *
 * ── 自动触发规则（想改去 inbox.js 的 maybeTrigger）────────────
 *   · 每天最多自动冒出一条新消息
 *   · 好感度不够的剧情不进候选池
 *   · 优先挑「还没玩过」的
 *
 * ⚠️ 改完这个文件必须重跑：node tools/gen_story_meta.mjs
 *    （story-meta.js 是给消息列表用的轻量索引，不会自动更新）
 * ===============================================================
 */
export const STORIES = [

  /* =============================================================
   * 示例 1：时段触发（带逐行注释，照着改就行）
   * 傍晚到深夜打开时有机会冒出来。
   * ============================================================= */
  {
    id: 'sample_slot',                    // 存储键，别改
    title: '示例：今天过得怎么样',          // 消息列表标题
    icon: 'happy',                        // 头像（common/emoji/happy_0.png）
    slots: ['evening', 'night'],          // 傍晚、晚上会触发
    start: 'a1',                          // 从 a1 开始

    steps: {
      // ① 开场：说两句，然后自动进入 a2
      a1: {
        say: [
          '忙完了吗？',
          '今天过得怎么样？'
        ],
        next: 'a2'
      },

      // ② 第一个选择点：三个选项各走各的分支，并累加 score
      a2: {
        say: ['说说看嘛。'],
        choices: [
          { text: '还不错', next: 'ok', score: 1 },      // 正面 → +1
          { text: '有点累', next: 'tired', score: 0 },   // 中性 → 0
          { text: '不想说', next: 'quiet', score: -1 }   // 消极 → -1
        ]
      },

      // ③ 三个分支都汇合到 a3（分支长短不必一致，但一定要能走下去）
      ok: { say: ['那就好。', '顺利的日子值得记住。'], next: 'a3' },
      tired: { say: ['累了就早点休息。', '事情明天再做也来得及。'], next: 'a3' },
      quiet: { say: ['……那我就不问了。', '我在这儿，你想说的时候再说。'], next: 'a3' },

      // ④ 第二个选择点：让分数再分一次档
      a3: {
        say: ['对了，今晚想做点什么？'],
        choices: [
          { text: '听会儿歌', next: 'music', score: 1 },
          { text: '早点睡', next: 'sleep', score: 1 },
          { text: '再熬一会儿', next: 'late', score: -1 }
        ]
      },
      music: { say: ['那我陪你听。', '把声音调小一点，别吵到别人。'], next: 'a4' },
      sleep: { say: ['好，那我不吵你了。', '晚安，明天见。'], next: 'a4' },
      late: { say: ['……我就知道。', '那至少把要做的事做完就去睡，好吗？'], next: 'a4' },

      // ⑤ 收尾：finish 触发结局结算
      a4: {
        say: ['那就这样吧。', '想说什么随时来找我。'],
        finish: true
      }
    },

    // 三种结局：score >= 2 走 good，<= -1 走 bad，其余 normal
    endings: {
      good: { name: '很好的一天', say: ['今天你状态不错呢。', '明天也这样就好啦。'] },
      normal: { name: '平常的一天', say: ['平平淡淡的一天也很好。', '早点休息哦。'] },
      bad: { name: '有点累的一天', say: ['别硬撑。', '明天会好一点的，真的。'] }
    }
  },

  /* =============================================================
   * 示例 2：日期触发
   * 只在周末出现（dates 命中，且当前时段在 slots 里）。
   * ============================================================= */
  {
    id: 'sample_date',
    title: '示例：周末',
    icon: 'idle',
    slots: ['morning', 'noon'],
    dates: ['weekend'],
    start: 'b1',
    steps: {
      b1: { say: ['周末啦。', '今天打算怎么过？'], next: 'b2' },
      b2: {
        say: ['说给我听听嘛。'],
        choices: [
          { text: '出去走走', next: 'b3', score: 1 },
          { text: '在家躺着', next: 'b4', score: 1 },
          { text: '还得加班', next: 'b5', score: -1 }
        ]
      },
      b3: { say: ['去吧去吧。', '记得看看天，别一直低头。'], next: 'b6' },
      b4: { say: ['躺着也很好。', '休息不需要理由。'], next: 'b6' },
      b5: { say: ['……辛苦了。', '忙完记得给自己留一点时间。'], next: 'b6' },
      b6: { say: ['周末愉快。'], finish: true }
    },
    endings: {
      good: { name: '周末', say: ['好好休息。'] },
      normal: { name: '周末', say: ['好好休息。'] },
      bad: { name: '周末', say: ['好好休息。'] }
    }
  },

  /* =============================================================
   * 示例 3：好感度门槛
   * minAff: 40 —— 好感度到 40（等级 3）才会自动出现。
   * 等级线在 config/affinity.js 的 LEVELS 里，别在这里硬记数字。
   * ============================================================= */
  {
    id: 'sample_aff',
    title: '示例：熟起来之后',
    icon: 'love',
    slots: ['night'],
    minAff: 40,
    start: 'c1',
    steps: {
      c1: { say: ['我们好像熟起来了呢。'], next: 'c2' },
      c2: {
        say: ['……我可以说一句实话吗？'],
        choices: [
          { text: '说吧', next: 'c3', score: 1 },
          { text: '先别说', next: 'c4', score: 0 },
          { text: '随便', next: 'c5', score: -1 }
        ]
      },
      c3: { say: ['其实我每天都在等你来。'], next: 'c6' },
      c4: { say: ['好，那我等你准备好。'], next: 'c6' },
      c5: { say: ['……那我就不说了。'], next: 'c6' },
      c6: { say: ['晚安。'], finish: true }
    },
    endings: {
      good: { name: '更进一步', say: ['谢谢你听我说。'] },
      normal: { name: '还没到时候', say: ['没关系，慢慢来。'] },
      bad: { name: '有点距离', say: ['……嗯。'] }
    }
  },

  /* =============================================================
   * 示例 4 / 5：终章 + 彩蛋（成对使用）
   *
   * 框架支持「满好感先冒一段彩蛋，玩完才放出最终消息」：
   *   · 彩蛋剧情（sample_egg）在好感度达到门槛时**强制**先出现，
   *     并且被排除在随机池之外 —— 不会混在日常剧情里被抽到
   *   · 彩蛋玩完后，最终消息（sample_final）才会被推出来
   *
   * 要启用这个机制，去 config/character.js 的 finale 里填两个 id：
   *     finale: { eggId: 'sample_egg', finalId: 'sample_final', minAff: 180 }
   * 不需要就把 eggId / finalId 留空，这两段就只是普通剧情。
   * ============================================================= */
  {
    id: 'sample_egg',
    title: '？？？',                  // 标题写成问号，做出「不知道是谁」的效果
    icon: 'think',                   // 头像也换个中性表情
    slots: [],                       // 不参与时段触发
    minAff: 180,
    noSticker: true,                 // 不贴表情
    noReward: true,                  // 玩完不加好感（不然可以反复刷）
    start: 'e1',
    steps: {
      e1: {
        say: ['你好。'],
        choices: [
          { text: '你是？', next: 'e2' },
          { text: '……', next: 'e2' },
          { text: '我不认识你', next: 'e2' }
        ]
      },
      e2: {
        say: ['我是写这段话的人。', '你能玩到这里，说明你陪了她很久。'],
        choices: [
          { text: '嗯', next: 'e3' },
          { text: '只是随便玩玩', next: 'e3' }
        ]
      },
      e3: { say: ['谢谢你。', '接下来这段，是属于你们两个人的了。'], finish: true }
    },
    endings: {
      good: { name: '彩蛋', say: ['再见。'] },
      normal: { name: '彩蛋', say: ['再见。'] },
      bad: { name: '彩蛋', say: ['再见。'] }
    }
  },

  {
    id: 'sample_final',
    title: '示例：最后一段',
    icon: 'love',
    slots: ['night', 'late'],
    minAff: 180,
    start: 'f1',
    steps: {
      f1: { say: ['有件事，我一直想说。'], next: 'f2' },
      f2: {
        say: ['……可以听我说完吗？'],
        choices: [
          { text: '我在听', next: 'f3', score: 1 },
          { text: '你说', next: 'f3', score: 1 },
          { text: '等一下', next: 'f3', score: 0 }
        ]
      },
      f3: { say: ['谢谢你还在这里。', '以后也一起走吧。'], finish: true }
    },
    endings: {
      good: { name: '一直在一起', say: ['说好了哦。'] },
      normal: { name: '一直在一起', say: ['说好了哦。'] },
      bad: { name: '一直在一起', say: ['说好了哦。'] }
    }
  }
]
