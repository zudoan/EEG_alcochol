import ElectrodeMap2D from '../components/ElectrodeMap2D'
import { ELECTRODE_INFO, electrodeInfo } from '../lib/eeg_electrode_knowledge'

const infoAll = new Proxy(ELECTRODE_INFO as any, {
  get: (target, prop: string) => {
    const k = String(prop)
    return target[k] || electrodeInfo(k)
  },
}) as any

const bands = [
  {
    name: 'Delta (0.5–4 Hz)',
    color: 'bg-indigo-500/30',
    desc:
      'Thường liên quan ngủ sâu. Delta tăng có thể xuất hiện khi buồn ngủ hoặc một số tình trạng ức chế thần kinh. Khi phân tích cần lưu ý bối cảnh đo.',
  },
  {
    name: 'Theta (4–8 Hz)',
    color: 'bg-sky-500/25',
    desc:
      'Liên quan buồn ngủ/giảm tỉnh táo, đôi khi gắn với xử lý trí nhớ và trạng thái thư giãn. Theta tăng có thể phản ánh mệt mỏi hoặc giảm tập trung.',
  },
  {
    name: 'Alpha (8–13 Hz)',
    color: 'bg-emerald-500/20',
    desc:
      'Thường rõ khi thư giãn tỉnh (đặc biệt nhắm mắt). Alpha giảm khi tập trung hoặc hoạt động nhận thức tăng. Đây là dải hay dùng để đánh giá mức độ tỉnh táo.',
  },
  {
    name: 'Beta (13–30 Hz)',
    color: 'bg-amber-500/20',
    desc:
      'Liên quan trạng thái tỉnh táo, hoạt động nhận thức. Beta tăng có thể xuất hiện khi căng thẳng/kích thích hoặc hoạt động cơ nhẹ.',
  },
  {
    name: 'Gamma (30–45 Hz)',
    color: 'bg-pink-500/20',
    desc:
      'Liên quan xử lý thông tin nhanh (cognitive binding). Tuy nhiên gamma rất dễ bị nhiễu bởi cơ (EMG), nên khi thấy gamma tăng cần cẩn trọng diễn giải.',
  },
]

export default function KienThucEEG() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Kiến thức EEG (dành cho người đọc)</h2>
        <p className="mt-2 text-sm text-white/60">
          Mục tiêu trang này là giúp bạn hiểu “biểu đồ trong phần Phân tích đang nói gì”.
        </p>
      </div>

      <ElectrodeMap2D
        title="Sơ đồ điện cực EEG (2D, tương tác)"
        subtitle="Click vào điện cực để xem mô tả vùng liên quan và ý nghĩa tăng/giảm (mang tính tổng quát) + nguồn tham khảo."
        infoByName={infoAll}
      />

      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="text-sm font-semibold">EEG là gì?</div>
        <div className="text-sm text-white/75 leading-relaxed">
          EEG (Electroencephalography) là tín hiệu điện thu từ da đầu, phản ánh hoạt động điện tổng hợp của não.
          Dữ liệu EEG thường có nhiều kênh (điện cực) và biến thiên theo thời gian.
        </div>
      </div>

      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="text-sm font-semibold">Cách đọc biểu đồ tần số</div>
        <div className="text-sm text-white/75 leading-relaxed space-y-2">
          <div>
            - <b>Time-series</b>: tín hiệu theo thời gian (biên độ dao động).
          </div>
          <div>
            - <b>PSD</b>: cho biết năng lượng tín hiệu tập trung ở tần số nào.
          </div>
          <div>
            - <b>Bandpower</b>: gom năng lượng theo từng dải tần để dễ so sánh.
          </div>
          <div>
            - <b>Spectrogram</b>: “PSD theo thời gian”, giúp thấy năng lượng từng dải tần thay đổi như thế nào theo thời gian.
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {bands.map((b) => (
          <div key={b.name} className="glass rounded-2xl p-5">
            <div className={`inline-flex rounded-full px-3 py-1 text-xs text-white/80 ${b.color}`}>{b.name}</div>
            <div className="mt-3 text-sm text-white/75 leading-relaxed">{b.desc}</div>
          </div>
        ))}
      </div>

      <div className="glass rounded-2xl p-5 space-y-2">
        <div className="text-sm font-semibold">Lưu ý y học & kỹ thuật</div>
        <div className="text-sm text-white/75 leading-relaxed space-y-2">
          <div>
            - Ý nghĩa các dải tần mang tính tổng quát; khi kết luận cần kết hợp bối cảnh đo và tiêu chuẩn lâm sàng.
          </div>
          <div>
            - Dải cao (beta/gamma) dễ nhiễu cơ/điện cực, nên trong phân tích thực tế thường cần bước làm sạch nhiễu.
          </div>
        </div>
      </div>
    </div>
  )
}
