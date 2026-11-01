// 日本語のデモの文とボタン、そしてデモが聞き取る言葉。
// A translation keeps every key, the functions' parameters, and the times as HH:MM.
const SLOTS = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];

// The date has no word before the time: "11月3日火曜日 10:00". Collapse the double space.
const tidy = (s) => s.replace(/ {2,}/g, ' ');

export default {
    locale: 'ja-JP',
    items: (list) => list.join('と'),
    names: { 'Linen shirt': 'リネンシャツ 1 点', 'Canvas tote bag': 'キャンバストートバッグ 1 点', 'Wool coat': 'ウールコート 1 点' },
    returnNames: { 'Linen shirt': 'リネンシャツ', 'Canvas tote bag': 'キャンバストートバッグ' },
    shipped: (n, placed, shipped, items) => `ご注文 ${n} は ${placed}にお受けし、${shipped}に発送しました。内容は${items}です。`,
    preparing: (n, placed, items) => `ご注文 ${n} は ${placed}にお受けしました。現在準備中で、まだ発送していません。内容は${items}です。`,
    noMatch: 'この番号とメールアドレスに一致するご注文は見つかりませんでした。',
    askEmail: (n) => `お調べするため、ご注文 ${n} にお使いのメールアドレスを教えていただけますか?`,
    askOrder: 'かしこまりました。ご注文番号と、ご注文時のメールアドレスを教えてください。',
    lookUp: 'お調べします。ご注文番号と、ご注文時のメールアドレスを教えてください。',
    notShipped: (n) => `ご注文 ${n} はまだ返品できません。返品できるのは発送済みのご注文のみです。`,
    confirmReturn: '下のボタンで返品をご確認ください。',
    returnQ: (item, n, reason) => `ご注文 ${n} の${item}の返品手続きを開始しますか? 理由: ${reason}`,
    openReturn: '返品手続きを開始',
    keepOrder: '注文を保持する',
    returnOpen: (n, email) => `ご注文 ${n} の返品手続きを開始しました。商品の返送方法を ${email} にメールでお送りします。`,
    kept: 'かしこまりました。ご注文はそのままにしておきます。ほかにご用件はありますか?',
    offTopic: 'ご注文と返品のご案内のみ承っております。そのほかのご用件は support@example.com までメールでお問い合わせください。',
    defaultReason: 'サイズが合わない',
    whichDay: '月曜日から金曜日の 9:00 から 17:00 まで、30 分の予約を承ります。ご都合のよい曜日はいつでしょうか?',
    offer: (day, times) => `${day}で承ります。${times.slice(0, -1).join('、')}、${times.at(-1)}のうち、どの時間がよろしいですか? お名前とメールアドレスもお知らせください。`,
    notFree: (t) => `${t} は空いている時間ではありません。${SLOTS.join('、')} からお選びください。`,
    needName: (t) => `${t} ですね。ご予約には、お名前とメールアドレスが必要です。`,
    confirmBooking: '下のボタンで予約をご確認ください。',
    bookQ: (when, name, email) => `${tidy(when)} に ${name} 様(${email})で予約しますか?`,
    bookIt: '予約する',
    another: '別の時間',
    booked: (when, name) => `予約しました: ${tidy(when)}、${name} 様。お待ちしております。`,
    otherTime: '承知しました。ほかのご都合のよい日時はいつでしょうか?',
    // No word between the date and the time.
    at: '',
    service: '予約、30 分',
    buttonsQ: '今夜 20:00 にお席をご予約しましょうか?',
    buttonsYes: '予約する',
    buttonsNo: '結構です',
    buttonsBooked: '予約しました: 今夜 20:00 のお席、お客様のお名前で。',
    buttonsDeclined: 'かしこまりました。予約はしていません。ほかにご用件はありますか?',
    filesNone: 'クリップのアイコンでファイルを添付していただければ、受け取った内容をお伝えします。',
    filesGot: (list) => `${list} を受け取りました。本物のワークフローなら、ここで中身を読み込みます: 質問に答えるための PDF、破損した荷物の写真、履歴書など。`,
    words: {
        returning: String.raw`返品|返却|返金|送り返|壊れ|破損|(小さ|大き)すぎ|小さい|大きい`,
        reason: String.raw`(?:サイズが)?(?:小さ|大き)すぎ(?:ます|ました|る)?|壊れ(?:ています|ていました|ました)?|破損|傷|サイズ(?:違い|が合わ(?:ない|ません))|気が変わ(?:りました|った)?`,
        order: String.raw`注文|荷物|配送|届|どこ`,
        shirt: String.raw`シャツ|リネン|麻`,
        bag: String.raw`トート|バッグ|かばん|鞄`,
        afternoon: String.raw`午後`,
        tomorrow: String.raw`明日`,
        first: String.raw`最初|一番目|1番目|初め`,
        // "火曜" matches 火曜 and 火曜日.
        days: ['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜'],
    },
};
