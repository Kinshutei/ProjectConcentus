import { lazy, Suspense } from 'react'
import type { PlotParams } from 'react-plotly.js'

/**
 * Plotly は 1MB を超えるので、グラフのあるタブを開いたときだけ読み込む。
 * plotly.js-dist-min を react-plotly.js の factory へ渡して使う。
 */
const Plot = lazy(async () => {
  const [{ default: createPlotly }, plotly] = await Promise.all([
    import('react-plotly.js/factory'),
    import('plotly.js-dist-min'),
  ])
  return { default: createPlotly(plotly) }
})

export default function Chart(props: PlotParams) {
  // layout の型は Partial<Layout> だが height を持たない定義のため、読み出しだけ緩める
  const layout = props.layout as { height?: number } | undefined
  const height = typeof layout?.height === 'number' ? layout.height : 320
  return (
    <Suspense fallback={<div style={{ height }} />}>
      <Plot {...props} />
    </Suspense>
  )
}
