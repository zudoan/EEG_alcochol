import { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { apiEda } from '../lib/api'

export default function GioiThieu() {
  const [eda, setEda] = useState<any>(null)

  useEffect(() => {
    apiEda().then((x) => setEda(x?.eda || null)).catch(() => setEda(null))
  }, [])

  const splitData = useMemo(() => {
    const tc = eda?.label_summary?.train_counts
    const tec = eda?.label_summary?.test_counts
    if (!Array.isArray(tc) || !Array.isArray(tec) || tc.length < 2 || tec.length < 2) return []
    return [
      { split: 'Train', control: Number(tc[0] || 0), alcoholic: Number(tc[1] || 0) },
      { split: 'Test', control: Number(tec[0] || 0), alcoholic: Number(tec[1] || 0) },
    ]
  }, [eda])

  const totals = useMemo(() => {
    if (splitData.length === 0) return null
    const train = splitData.find((x) => x.split === 'Train')
    const test = splitData.find((x) => x.split === 'Test')
    const trainN = (train?.control || 0) + (train?.alcoholic || 0)
    const testN = (test?.control || 0) + (test?.alcoholic || 0)
    return { trainN, testN }
  }, [splitData])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Giới thiệu Project</h2>
        <p className="mt-2 text-sm text-white/60">
          Trang này tóm tắt mục tiêu, dữ liệu và ý tưởng chính để người đọc hiểu nhanh “bài này làm gì”.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass rounded-2xl p-5">
          <div className="text-sm font-semibold">Số lượng mẫu theo tập</div>
          <div className="mt-1 text-xs text-white/60">Tóm tắt nhanh train/test từ pipeline (đọc từ /eda).</div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <div className="text-xs text-white/60">Train</div>
              <div className="mt-1 text-2xl font-bold">{totals ? totals.trainN : '—'}</div>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <div className="text-xs text-white/60">Test</div>
              <div className="mt-1 text-2xl font-bold">{totals ? totals.testN : '—'}</div>
            </div>
          </div>
          <div className="mt-3 text-xs text-white/60">
            {eda?.dataset_shapes?.dropped_test != null ? (
              <>Đã loại <b>{Number(eda.dataset_shapes.dropped_test)}</b> mẫu test trùng nội dung với train (rò rỉ).</>
            ) : null}
          </div>
        </div>

        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <div className="text-sm font-semibold">Phân bố nhãn (Train/Test)</div>
          <div className="mt-1 text-xs text-white/60">Control (c=0) và Alcoholic (a=1).</div>
          <div className="mt-3 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={splitData}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="split" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'rgba(10,12,24,0.9)', border: '1px solid rgba(255,255,255,0.12)' }} />
                <Legend />
                <Bar dataKey="control" name="Control (c=0)" stackId="a" fill="#34d399" radius={[10, 10, 0, 0]} />
                <Bar dataKey="alcoholic" name="Alcoholic (a=1)" stackId="a" fill="#a5b4fc" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="text-sm font-semibold">1) Bài toán</div>
        <div className="text-sm text-white/75 leading-relaxed">
          Dựa trên tín hiệu EEG (điện não đồ) thu theo nhiều điện cực, chúng ta xây dựng mô hình học máy để
          <b> phân loại</b> một mẫu thuộc nhóm <b>Control</b> (c) hay <b>Alcoholic</b> (a).
          Trong dữ liệu gốc, nhãn được mã hoá: <b>a → 1</b>, <b>c → 0</b>.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass rounded-2xl p-5 space-y-3">
          <div className="text-sm font-semibold">2) Dữ liệu (SMNI_CMI)</div>
          <div className="text-sm text-white/75 leading-relaxed space-y-2">
            <div>
              - Mỗi file CSV là một phiên đo EEG (một trial) gồm nhiều kênh (điện cực) và nhiều mẫu theo thời gian.
            </div>
            <div>
              - Project dùng <b>SMNI_CMI_TRAIN</b> làm tập train và <b>SMNI_CMI_TEST</b> làm tập test.
            </div>
            <div>
              - Có kiểm tra rò rỉ dữ liệu bằng <b>hash MD5</b> và loại các file test trùng nội dung train.
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-5 space-y-3">
          <div className="text-sm font-semibold">3) Ý tưởng đặc trưng</div>
          <div className="text-sm text-white/75 leading-relaxed space-y-2">
            <div>
              EEG là tín hiệu theo thời gian, nhưng rất giàu thông tin ở miền tần số.
              Vì vậy ta trích xuất:
            </div>
            <div>
              - <b>PSD</b> (Power Spectral Density) bằng Welch
            </div>
            <div>
              - <b>Bandpower</b> theo các dải tần (delta/theta/alpha/beta/gamma)
            </div>
            <div>
              - <b>Spectrogram</b> (phổ theo thời gian) để quan sát sự biến thiên theo thời gian
            </div>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="text-sm font-semibold">4) Bạn nên xem gì tiếp?</div>
        <div className="text-sm text-white/75 leading-relaxed space-y-2">
          <div>
            - Vào <b>Kiến thức EEG</b> để hiểu ý nghĩa y học của các dải tần.
          </div>
          <div>
            - Vào <b>Quy trình</b> để xem pipeline tiền xử lý và trích đặc trưng.
          </div>
          <div>
            - Vào <b>Phân tích</b> để tải file và xem biểu đồ (PSD/bandpower/spectrogram).
          </div>
        </div>
      </div>
    </div>
  )
}
