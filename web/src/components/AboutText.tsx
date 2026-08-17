const OWNER = '白百合と金鷲亭'
const OWNER_X = 'https://x.com/WL_GE_inn'

/**
 * About の本文。領域ごとに文面がぶれないよう1箇所にまとめる。
 * 装飾は各領域のCSSに任せ、ここでは中身だけを持つ。
 */
export default function AboutText({ singer }: { singer: string }) {
  return (
    <div className="about-text">
      <p>
        このサイトは、VSinger {singer}
        さんの歌枠のセットリストを閲覧できる、非公式のファンメイドデータベースです。
        いつどの曲を歌ったのかを、曲名やアーティストから辿ることができます。
      </p>
      <p>
        運営には{singer}さんご本人は一切携わっておりません。
        当サイトの内容についてのお問い合わせは、演者様ではなく当方（
        <a href={OWNER_X} target="_blank" rel="noopener noreferrer">
          {OWNER}
        </a>
        ）までお願いいたします。
      </p>
      <p>
        更新は現時点で当方ひとりで行っております。
        掲載内容に誤りやお気づきの点がありましたら、
        <a href={OWNER_X} target="_blank" rel="noopener noreferrer">
          X
        </a>
        のリプライまたはDMでお知らせいただけると助かります。
      </p>
    </div>
  )
}
