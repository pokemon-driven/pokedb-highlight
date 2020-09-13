import puppeteer from 'puppeteer'
import dayjs from 'dayjs'
import axios from 'axios'
import FormData from 'form-data'

const Environments = {
  GYAZO_ACCESS_TOKEN: process.env.GYAZO_ACCESS_TOKEN,
  SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
} as const

type UploadAPIResponse = {
  image_id: string
  permalink_url: string
  thumb_url: string
  url: string
  type: string
}

async function run() {
  if (!(Environments.GYAZO_ACCESS_TOKEN && Environments.SLACK_WEBHOOK_URL)) {
    console.error('Missing environment variables')
    return process.exit(1)
  }

  const browser = await puppeteer.launch({
    defaultViewport: {
      width: 1440,
      height: 910,
    },
    args: ['--window-size=1440,1040'],
  })
  const page = await browser.newPage()
  await page.goto('https://swsh.pokedb.tokyo/pokemon/list')
  const list = await Promise.all(
    new Array(10).fill(0).map(async (_, i) => {
      const el = await page.$(
        `.content .column:nth-child(${i + 1}) .pokemon-ranking-name`
      )
      const text = await el?.getProperty('textContent')
      const v = await text?.jsonValue()
      const name = `${v}`.replace(/ /g, '').replace(/\n/g, '')
      return {
        order: i + 1,
        name,
      }
    })
  )
  const ss = await page.screenshot()
  try {
    const form = new FormData()
    form.append('access_token', `${Environments.GYAZO_ACCESS_TOKEN}`)
    form.append('imagedata', ss, {
      filename: 'ss.png',
      knownLength: ss.length,
    })
    const res = await axios.post<UploadAPIResponse>(
      'https://upload.gyazo.com/api/upload',
      form,
      {
        headers: form.getHeaders(),
      }
    )
    console.log(res.status + ' ' + res.statusText)
    const t = `${dayjs().format(
      'YYYY/MM/DD HH:mm'
    )} のシングルバトルポケモン使用率ランキング

${list.map((p) => `${p.order}. ${p.name}`).join('\n')}

データソース: https://swsh.pokedb.tokyo/pokemon/list
スクショ   : ${res.data.permalink_url.replace('gyazo', 'i.gyazo')}.png`
    console.log(t)
    await axios.post(
      Environments.SLACK_WEBHOOK_URL,
      {
        text: t,
      },
      {
        headers: {},
      }
    )
  } catch (e) {
    console.log(e.response)
  }
  process.exit(0)
}

run()
