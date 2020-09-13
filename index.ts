import puppeteer from 'puppeteer'
import { promises as fs } from 'fs'
import dayjs from 'dayjs'
import axios from 'axios'
import FormData from 'form-data'

type UploadAPIResponse = {
  "image_id" : string
  "permalink_url": string
  "thumb_url" : string
  "url" : string
  "type": string
}

async function run() {
  const browser = await puppeteer.launch({
    defaultViewport: {
      width: 1440,
      height: 910
    },
    args: [
      '--window-size=1440,1040'
    ]
  })
  const page = await browser.newPage()
  await page.goto('https://swsh.pokedb.tokyo/pokemon/list')
  const list = await Promise.all(
    (new Array(10).fill(0).map(async (_, i) => {
      const el = await page.$(`.content .column:nth-child(${i+1}) .pokemon-ranking-name`)
      const text = await el?.getProperty('textContent')
      const v = await text?.jsonValue()
      const name = `${v}`.replace(/ /g, '').replace(/\n/g, '')
      return {
        order: i+1,
        name
      }
    }))
  )
  const t = `${dayjs().format('YYYY/MM/DD hh:mm')} 時点のポケモン使用率ランキング

${list.map((p) => `${p.order}. ${p.name}`).join('\n')}

#pokedbhighlight
data source: https://swsh.pokedb.tokyo/pokemon/list`
  console.log(t)
  const ss = await page.screenshot()
  // await fs.writeFile('ss.png', ss)
  try {
    const form = new FormData()
    form.append('access_token', `${process.env.GYAZO_ACCESS_TOKEN}`)
    form.append('imagedata', ss, {
      filename: 'ss.png',
      contentType: 'image/png',
      knownLength: ss.length
    })
    const res = await axios.post<UploadAPIResponse>('https://upload.gyazo.com/api/upload',
    form,
    {
      headers: form.getHeaders()
    }
    )
    console.log(res.data.permalink_url)
  } catch(e) {
    console.log(e)
  }
  process.exit(0)
}

run()
