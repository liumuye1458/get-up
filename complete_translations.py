"""
complete_translations.py

Fill core UI translations for zh / id / th / vi / es using the actual flat
key structure used by the current i18n files.
"""
from __future__ import annotations

import json
from pathlib import Path


I18N_DIR = Path(__file__).resolve().parent / "i18n"


TRANSLATIONS: dict[str, dict[str, str]] = {
    "app.title": {"zh": "HOTA SoundPad", "id": "HOTA SoundPad", "th": "HOTA SoundPad", "vi": "HOTA SoundPad", "es": "HOTA SoundPad"},
    "nav.sounds": {"zh": "我的音效", "id": "Efek Saya", "th": "เสียงของฉัน", "vi": "Âm Thanh Của Tôi", "es": "Mis Sonidos"},
    "nav.bgm": {"zh": "背景音乐", "id": "Musik Latar", "th": "เพลงพื้นหลัง", "vi": "Nhạc Nền", "es": "Música de Fondo"},
    "nav.backup": {"zh": "备份与恢复", "id": "Cadangan & Pemulihan", "th": "สำรองและกู้คืน", "vi": "Sao Lưu & Khôi Phục", "es": "Respaldo y Restauración"},
    "nav.settings": {"zh": "设置", "id": "Pengaturan", "th": "ตั้งค่า", "vi": "Cài Đặt", "es": "Ajustes"},
    "nav.help": {"zh": "帮助", "id": "Bantuan", "th": "ช่วยเหลือ", "vi": "Trợ Giúp", "es": "Ayuda"},
    "settings.title": {"zh": "设置", "id": "Pengaturan", "th": "ตั้งค่า", "vi": "Cài đặt", "es": "Ajustes"},
    "settings.section.device": {"zh": "输出设备", "id": "Perangkat Output", "th": "อุปกรณ์เอาต์พุต", "vi": "Thiết bị đầu ra", "es": "Dispositivo de salida"},
    "settings.section.func_hotkeys": {"zh": "功能快捷键", "id": "Pintasan Fungsi", "th": "ปุ่มลัดฟังก์ชัน", "vi": "Phím tắt chức năng", "es": "Teclas de función"},
    "settings.hotkey_mode": {"zh": "快捷键模式", "id": "Mode Pintasan", "th": "โหมดปุ่มลัด", "vi": "Chế độ phím tắt", "es": "Modo de teclas"},
    "settings.hotkey_global": {"zh": "全局模式（任何时候生效）", "id": "Mode Global (aktif di mana saja)", "th": "โหมดทั่วระบบ (ใช้ได้ทุกที่)", "vi": "Chế độ toàn cục (hoạt động mọi nơi)", "es": "Modo Global (funciona en todas partes)"},
    "settings.hotkey_local": {"zh": "局部模式（仅窗口聚焦时生效）", "id": "Mode Lokal (hanya saat jendela aktif)", "th": "โหมดเฉพาะที่ (เฉพาะเมื่อโฟกัสหน้าต่าง)", "vi": "Chế độ cục bộ (chỉ khi cửa sổ được chọn)", "es": "Modo Local (solo con ventana enfocada)"},
    "settings.hotkey.stop_all": {"zh": "停止全部音效", "id": "Hentikan semua efek", "th": "หยุดเสียงทั้งหมด", "vi": "Dừng tất cả âm thanh", "es": "Detener todos los sonidos"},
    "settings.hotkey.bgm_play_pause": {"zh": "BGM 播放/暂停", "id": "BGM putar/jeda", "th": "BGM เล่น/หยุด", "vi": "BGM phát/tạm dừng", "es": "BGM reproducir/pausar"},
    "settings.hotkey.bgm_vol_up": {"zh": "BGM 音量增大", "id": "BGM volume naik", "th": "BGM เพิ่มเสียง", "vi": "BGM tăng âm lượng", "es": "BGM subir volumen"},
    "settings.hotkey.bgm_vol_down": {"zh": "BGM 音量减小", "id": "BGM volume turun", "th": "BGM ลดเสียง", "vi": "BGM giảm âm lượng", "es": "BGM bajar volumen"},
    "settings.hotkey.stop_all_music": {"zh": "停止全部音乐", "id": "Hentikan semua musik", "th": "หยุดเพลงทั้งหมด", "vi": "Dừng tất cả nhạc", "es": "Detener toda la música"},
    "settings.hotkey.toggle_window": {"zh": "最小化/显示窗口", "id": "Sembunyikan/tampilkan jendela", "th": "ย่อ/แสดงหน้าต่าง", "vi": "Thu nhỏ/hiện cửa sổ", "es": "Minimizar/mostrar ventana"},
    "settings.hotkey.toggle_floating": {"zh": "显示/隐藏悬浮窗", "id": "Tampilkan/sembunyikan jendela mengambang", "th": "แสดง/ซ่อนหน้าต่างลอย", "vi": "Hiện/ẩn cửa sổ nổi", "es": "Mostrar/ocultar ventana flotante"},
    "settings.hotkey_unset": {"zh": "未设置", "id": "Belum diatur", "th": "ยังไม่ตั้ง", "vi": "Chưa đặt", "es": "No configurado"},
    "settings.record": {"zh": "录制", "id": "Rekam", "th": "บันทึก", "vi": "Ghi", "es": "Grabar"},
    "settings.clear": {"zh": "清除", "id": "Hapus", "th": "ล้าง", "vi": "Xóa", "es": "Borrar"},
    "settings.section.floating": {"zh": "悬浮窗", "id": "Jendela Mengambang", "th": "หน้าต่างลอย", "vi": "Cửa Sổ Nổi", "es": "Ventana Flotante"},
    "settings.show_floating": {"zh": "显示悬浮窗", "id": "Tampilkan Jendela Mengambang", "th": "แสดงหน้าต่างลอย", "vi": "Hiện Cửa Sổ Nổi", "es": "Mostrar Ventana Flotante"},
    "bottom.output_short": {"zh": "输出", "id": "Output", "th": "เอาต์พุต", "vi": "Đầu ra", "es": "Salida"},
    "sounds.import": {"zh": "+ 添加音效", "id": "+ Tambah Efek", "th": "+ เพิ่มเสียง", "vi": "+ Thêm Âm Thanh", "es": "+ Añadir Sonido"},
    "sounds.search.placeholder": {"zh": "搜索音效名称、标签、快捷键...", "id": "Cari efek suara, tag, pintasan...", "th": "ค้นหาเสียง แท็ก ปุ่มลัด...", "vi": "Tìm âm thanh, thẻ, phím tắt...", "es": "Buscar sonidos, etiquetas, atajos..."},
    "sounds.tag.all": {"zh": "全部", "id": "Semua", "th": "ทั้งหมด", "vi": "Tất cả", "es": "Todos"},
    "sounds.add_tag": {"zh": "+ 新建标签", "id": "+ Tag Baru", "th": "+ แท็กใหม่", "vi": "+ Thẻ Mới", "es": "+ Nueva Etiqueta"},
    "sounds.import_progress": {"zh": "正在导入音效...", "id": "Mengimpor efek suara...", "th": "กำลังนำเข้าเสียง...", "vi": "Đang nhập âm thanh...", "es": "Importando sonidos..."},
    "sounds.import_progress_item": {"zh": "正在导入 ({current}/{total})：\n{name}", "id": "Mengimpor ({current}/{total}):\n{name}", "th": "กำลังนำเข้า ({current}/{total}):\n{name}", "vi": "Đang nhập ({current}/{total}):\n{name}", "es": "Importando ({current}/{total}):\n{name}"},
    "bgm.title": {"zh": "背景音乐", "id": "Musik Latar", "th": "เพลงพื้นหลัง", "vi": "Nhạc Nền", "es": "Música de Fondo"},
    "bgm.add": {"zh": "+ 导入背景音乐", "id": "+ Impor BGM", "th": "+ นำเข้า BGM", "vi": "+ Nhập BGM", "es": "+ Importar BGM"},
    "bgm.hotkey_unset": {"zh": "快捷键未设置", "id": "Pintasan belum diatur", "th": "ยังไม่ได้ตั้งปุ่มลัด", "vi": "Chưa đặt phím tắt", "es": "Atajo no configurado"},
    "bgm.menu.play": {"zh": "播放", "id": "Putar", "th": "เล่น", "vi": "Phát", "es": "Reproducir"},
    "bgm.menu.pause": {"zh": "暂停", "id": "Jeda", "th": "หยุดชั่วคราว", "vi": "Tạm dừng", "es": "Pausar"},
    "bgm.menu.edit": {"zh": "编辑 BGM...", "id": "Edit BGM...", "th": "แก้ไข BGM...", "vi": "Chỉnh sửa BGM...", "es": "Editar BGM..."},
    "bgm.menu.duplicate": {"zh": "复制", "id": "Duplikat", "th": "ทำสำเนา", "vi": "Nhân bản", "es": "Duplicar"},
    "bgm.menu.delete": {"zh": "删除", "id": "Hapus", "th": "ลบ", "vi": "Xóa", "es": "Eliminar"},
    "bgm.delete_title": {"zh": "删除背景音乐", "id": "Hapus Musik Latar", "th": "ลบเพลงพื้นหลัง", "vi": "Xóa nhạc nền", "es": "Eliminar música de fondo"},
    "bgm.delete_confirm": {"zh": "确定删除 {name} 吗？", "id": "Hapus {name}?", "th": "ลบ {name} ใช่หรือไม่?", "vi": "Xóa {name}?", "es": "¿Eliminar {name}?"},
    "bgm.search.placeholder": {"zh": "搜索背景音乐...", "id": "Cari musik latar...", "th": "ค้นหาเพลงพื้นหลัง...", "vi": "Tìm nhạc nền...", "es": "Buscar música de fondo..."},
    "bgm.subtitle": {"zh": "{duration} · {hotkey}", "id": "{duration} · {hotkey}", "th": "{duration} · {hotkey}", "vi": "{duration} · {hotkey}", "es": "{duration} · {hotkey}"},
    "bgm.import_progress": {"zh": "正在导入背景音乐...", "id": "Mengimpor musik latar...", "th": "กำลังนำเข้าเพลงพื้นหลัง...", "vi": "Đang nhập nhạc nền...", "es": "Importando música de fondo..."},
    "bgm.import_progress_item": {"zh": "正在导入 ({current}/{total})：\n{name}", "id": "Mengimpor ({current}/{total}):\n{name}", "th": "กำลังนำเข้า ({current}/{total}):\n{name}", "vi": "Đang nhập ({current}/{total}):\n{name}", "es": "Importando ({current}/{total}):\n{name}"},
    "common.importing": {"zh": "导入中", "id": "Mengimpor", "th": "กำลังนำเข้า", "vi": "Đang nhập", "es": "Importando"},
    "common.exporting": {"zh": "导出中", "id": "Mengekspor", "th": "กำลังส่งออก", "vi": "Đang xuất", "es": "Exportando"},
    "common.error_message": {"zh": "错误：{message}", "id": "Kesalahan: {message}", "th": "ข้อผิดพลาด: {message}", "vi": "Lỗi: {message}", "es": "Error: {message}"},
    "common.audio_files_filter": {"zh": "音频文件 ({exts})", "id": "File Audio ({exts})", "th": "ไฟล์เสียง ({exts})", "vi": "Tệp âm thanh ({exts})", "es": "Archivos de audio ({exts})"},
    "common.select_audio_files": {"zh": "选择音频文件", "id": "Pilih File Audio", "th": "เลือกไฟล์เสียง", "vi": "Chọn tệp âm thanh", "es": "Seleccionar archivos de audio"},
    "common.name": {"zh": "名称", "id": "Nama", "th": "ชื่อ", "vi": "Tên", "es": "Nombre"},
    "common.color": {"zh": "颜色", "id": "Warna", "th": "สี", "vi": "Màu", "es": "Color"},
    "common.fade_in": {"zh": "淡入", "id": "Fade In", "th": "เฟดอิน", "vi": "Fade In", "es": "Fade In"},
    "common.fade_in_duration": {"zh": "淡入时长", "id": "Durasi Fade", "th": "ระยะเวลาเฟด", "vi": "Thời gian fade", "es": "Duración del fade"},
    "common.start_time": {"zh": "开始时间", "id": "Waktu Mulai", "th": "เวลาเริ่มต้น", "vi": "Thời gian bắt đầu", "es": "Hora de inicio"},
    "common.end_time": {"zh": "结束时间", "id": "Waktu Selesai", "th": "เวลาสิ้นสุด", "vi": "Thời gian kết thúc", "es": "Hora de fin"},
    "common.volume": {"zh": "音量", "id": "Volume", "th": "ระดับเสียง", "vi": "Âm lượng", "es": "Volumen"},
    "common.speed": {"zh": "播放速度", "id": "Kecepatan Putar", "th": "ความเร็วในการเล่น", "vi": "Tốc độ phát", "es": "Velocidad de reproducción"},
    "common.loop_playback": {"zh": "循环播放", "id": "Putar Ulang", "th": "เล่นซ้ำ", "vi": "Phát lặp", "es": "Reproducción en bucle"},
    "common.preview_clip": {"zh": "预览片段", "id": "Pratinjau Klip", "th": "พรีวิวคลิป", "vi": "Xem trước đoạn cắt", "es": "Vista previa del clip"},
    "common.stop": {"zh": "停止", "id": "Hentikan", "th": "หยุด", "vi": "Dừng", "es": "Detener"},
    "common.clear_clip": {"zh": "清除裁剪", "id": "Hapus Klip", "th": "ล้างช่วงตัด", "vi": "Xóa đoạn cắt", "es": "Borrar recorte"},
    "common.total_duration": {"zh": "总时长：{duration}s", "id": "Total: {duration}s", "th": "รวม: {duration}s", "vi": "Tổng: {duration}s", "es": "Total: {duration}s"},
    "common.clipped_duration": {"zh": "裁剪后：{duration}s", "id": "Dipotong: {duration}s", "th": "หลังตัด: {duration}s", "vi": "Sau khi cắt: {duration}s", "es": "Recortado: {duration}s"},
    "backup.title": {"zh": "备份与恢复", "id": "Cadangan & Pemulihan", "th": "สำรองและกู้คืน", "vi": "Sao Lưu & Khôi Phục", "es": "Respaldo y Restauración"},
    "backup.desc": {"zh": "导出所有音效、背景音乐和设置到备份文件，或从备份中恢复。", "id": "Ekspor semua suara, musik latar, dan pengaturan ke file cadangan, atau pulihkan dari cadangan.", "th": "ส่งออกเสียง เพลงพื้นหลัง และการตั้งค่าทั้งหมดไปยังไฟล์สำรอง หรือกู้คืนจากไฟล์สำรอง", "vi": "Xuất toàn bộ âm thanh, nhạc nền và cài đặt ra tệp sao lưu, hoặc khôi phục từ bản sao lưu.", "es": "Exporta todos los sonidos, música de fondo y ajustes a un archivo de respaldo, o restaura desde uno."},
    "backup.export_section": {"zh": "导出备份", "id": "Ekspor Cadangan", "th": "ส่งออกข้อมูลสำรอง", "vi": "Xuất Bản Sao Lưu", "es": "Exportar Respaldo"},
    "backup.export_desc": {"zh": "将当前所有音效、BGM 和设置导出为一个 .zip 备份文件。", "id": "Ekspor semua suara, BGM, dan pengaturan saat ini ke satu file cadangan .zip.", "th": "ส่งออกเสียง BGM และการตั้งค่าปัจจุบันทั้งหมดเป็นไฟล์สำรอง .zip เดียว", "vi": "Xuất toàn bộ âm thanh, BGM và cài đặt hiện tại thành một tệp sao lưu .zip.", "es": "Exporta todos los sonidos, BGM y ajustes actuales a un único archivo .zip de respaldo."},
    "backup.import_section": {"zh": "导入备份", "id": "Impor Cadangan", "th": "นำเข้าข้อมูลสำรอง", "vi": "Nhập Bản Sao Lưu", "es": "Importar Respaldo"},
    "backup.import_desc": {"zh": "从备份文件恢复数据。你可以覆盖当前数据或与当前数据合并。", "id": "Pulihkan data dari file cadangan. Anda bisa menimpa atau menggabungkannya dengan data saat ini.", "th": "กู้คืนข้อมูลจากไฟล์สำรอง คุณสามารถเลือกเขียนทับหรือรวมกับข้อมูลปัจจุบันได้", "vi": "Khôi phục dữ liệu từ tệp sao lưu. Bạn có thể ghi đè hoặc gộp với dữ liệu hiện tại.", "es": "Restaura datos desde un archivo de respaldo. Puedes sobrescribir o fusionar con los datos actuales."},
    "backup.export_button": {"zh": "导出备份...", "id": "Ekspor Cadangan...", "th": "ส่งออกข้อมูลสำรอง...", "vi": "Xuất Bản Sao Lưu...", "es": "Exportar Respaldo..."},
    "backup.import_button": {"zh": "导入备份...", "id": "Impor Cadangan...", "th": "นำเข้าข้อมูลสำรอง...", "vi": "Nhập Bản Sao Lưu...", "es": "Importar Respaldo..."},
    "backup.export_success_title": {"zh": "导出成功", "id": "Ekspor Berhasil", "th": "ส่งออกสำเร็จ", "vi": "Xuất Thành Công", "es": "Exportación Correcta"},
    "backup.export_success_message": {"zh": "备份已保存到：\n{path}", "id": "Cadangan disimpan di:\n{path}", "th": "บันทึกไฟล์สำรองไว้ที่:\n{path}", "vi": "Bản sao lưu đã được lưu tại:\n{path}", "es": "El respaldo se guardó en:\n{path}"},
    "backup.export_fail_title": {"zh": "导出失败", "id": "Ekspor Gagal", "th": "ส่งออกล้มเหลว", "vi": "Xuất Thất Bại", "es": "Error de Exportación"},
    "backup.import_select_title": {"zh": "选择备份文件", "id": "Pilih File Cadangan", "th": "เลือกไฟล์สำรอง", "vi": "Chọn Tệp Sao Lưu", "es": "Seleccionar Archivo de Respaldo"},
    "backup.invalid_title": {"zh": "无效文件", "id": "File Tidak Valid", "th": "ไฟล์ไม่ถูกต้อง", "vi": "Tệp Không Hợp Lệ", "es": "Archivo no válido"},
    "backup.invalid_message": {"zh": "所选文件不是有效的备份文件。", "id": "File yang dipilih bukan file cadangan yang valid.", "th": "ไฟล์ที่เลือกไม่ใช่ไฟล์สำรองที่ถูกต้อง", "vi": "Tệp đã chọn không phải là tệp sao lưu hợp lệ.", "es": "El archivo seleccionado no es un respaldo válido."},
    "backup.import_mode_title": {"zh": "选择导入模式", "id": "Pilih Mode Impor", "th": "เลือกโหมดการนำเข้า", "vi": "Chọn Chế Độ Nhập", "es": "Elegir modo de importación"},
    "backup.import_mode_prompt": {"zh": "请选择如何处理当前数据：", "id": "Pilih cara menangani data saat ini:", "th": "เลือกวิธีจัดการข้อมูลปัจจุบัน:", "vi": "Chọn cách xử lý dữ liệu hiện tại:", "es": "Elige cómo manejar los datos actuales:"},
    "backup.import_mode_overwrite": {"zh": "覆盖（清空当前数据并完全替换）", "id": "Timpa (hapus data saat ini dan ganti sepenuhnya)", "th": "เขียนทับ (ล้างข้อมูลปัจจุบันและแทนที่ทั้งหมด)", "vi": "Ghi đè (xóa dữ liệu hiện tại và thay thế hoàn toàn)", "es": "Sobrescribir (borrar los datos actuales y reemplazar completamente)"},
    "backup.import_mode_merge": {"zh": "合并（保留当前数据并追加新项目）", "id": "Gabungkan (simpan data saat ini dan tambahkan item baru)", "th": "รวม (เก็บข้อมูลปัจจุบันและเพิ่มรายการใหม่)", "vi": "Gộp (giữ dữ liệu hiện tại và thêm mục mới)", "es": "Fusionar (mantener los datos actuales y agregar elementos nuevos)"},
    "backup.import_fail_title": {"zh": "导入失败", "id": "Impor Gagal", "th": "นำเข้าล้มเหลว", "vi": "Nhập Thất Bại", "es": "Error de Importación"},
    "backup.import_success_title": {"zh": "导入成功", "id": "Impor Berhasil", "th": "นำเข้าสำเร็จ", "vi": "Nhập Thành Công", "es": "Importación Correcta"},
    "backup.import_success_message": {"zh": "备份数据已恢复，界面已刷新。", "id": "Data cadangan telah dipulihkan dan UI telah diperbarui.", "th": "กู้คืนข้อมูลสำรองแล้ว และรีเฟรชหน้าจอเรียบร้อย", "vi": "Dữ liệu sao lưu đã được khôi phục và giao diện đã được làm mới.", "es": "Los datos del respaldo se restauraron y la interfaz se actualizó."},
    "backup.file_filter": {"zh": "备份文件 (*.zip)", "id": "File Cadangan (*.zip)", "th": "ไฟล์สำรอง (*.zip)", "vi": "Tệp Sao Lưu (*.zip)", "es": "Archivos de respaldo (*.zip)"},
    "backup.export_progress": {"zh": "正在导出备份...", "id": "Mengekspor cadangan...", "th": "กำลังส่งออกข้อมูลสำรอง...", "vi": "Đang xuất bản sao lưu...", "es": "Exportando respaldo..."},
    "backup.import_progress": {"zh": "正在导入备份...", "id": "Mengimpor cadangan...", "th": "กำลังนำเข้าข้อมูลสำรอง...", "vi": "Đang nhập bản sao lưu...", "es": "Importando respaldo..."},
    "backup.export_done": {"zh": "备份导出成功。", "id": "Cadangan berhasil diekspor.", "th": "ส่งออกข้อมูลสำรองสำเร็จ", "vi": "Xuất bản sao lưu thành công.", "es": "Respaldo exportado correctamente."},
    "backup.import_done": {"zh": "备份导入成功。", "id": "Cadangan berhasil diimpor.", "th": "นำเข้าข้อมูลสำรองสำเร็จ", "vi": "Nhập bản sao lưu thành công.", "es": "Respaldo importado correctamente."},
    "dialog.confirm_delete": {"zh": "确定删除“{name}”吗？", "id": "Hapus \"{name}\"?", "th": "ลบ \"{name}\" ใช่หรือไม่?", "vi": "Xóa \"{name}\"?", "es": "¿Eliminar \"{name}\"?"},
    "dialog.delete_title": {"zh": "删除音效", "id": "Hapus Suara", "th": "ลบเสียง", "vi": "Xóa âm thanh", "es": "Eliminar sonido"},
    "common.file_path": {"zh": "文件路径", "id": "Path File", "th": "ตำแหน่งไฟล์", "vi": "Đường dẫn tệp", "es": "Ruta del archivo"},
    "common.open_folder": {"zh": "打开目录", "id": "Buka Folder", "th": "เปิดโฟลเดอร์", "vi": "Mở thư mục", "es": "Abrir carpeta"},
    "common.cancel": {"zh": "取消", "id": "Batal", "th": "ยกเลิก", "vi": "Hủy", "es": "Cancelar"},
    "common.save": {"zh": "保存", "id": "Simpan", "th": "บันทึก", "vi": "Lưu", "es": "Guardar"},
    "common.no_tag": {"zh": "（无标签）", "id": "(Tanpa Tag)", "th": "(ไม่มีแท็ก)", "vi": "(Không có thẻ)", "es": "(Sin etiqueta)"},
    "common.assigned_tag": {"zh": "所属标签", "id": "Tag", "th": "แท็ก", "vi": "Thẻ", "es": "Etiqueta"},
    "common.record": {"zh": "录制", "id": "Rekam", "th": "บันทึก", "vi": "Ghi", "es": "Grabar"},
    "dialog.edit_sound": {"zh": "编辑音效", "id": "Edit Efek Suara", "th": "แก้ไขเสียง", "vi": "Chỉnh sửa âm thanh", "es": "Editar sonido"},
    "dialog.edit_bgm": {"zh": "编辑背景音乐", "id": "Edit BGM", "th": "แก้ไข BGM", "vi": "Chỉnh sửa BGM", "es": "Editar BGM"},
    "dialog.sound_name": {"zh": "音效名称", "id": "Nama Efek", "th": "ชื่อเสียง", "vi": "Tên âm thanh", "es": "Nombre del sonido"},
    "dialog.card_color": {"zh": "卡片颜色", "id": "Warna Kartu", "th": "สีการ์ด", "vi": "Màu thẻ", "es": "Color de tarjeta"},
    "dialog.fade_in": {"zh": "淡入播放", "id": "Fade In", "th": "เฟดอิน", "vi": "Fade In", "es": "Fade In"},
    "dialog.fade_duration": {"zh": "淡入时长", "id": "Durasi Fade", "th": "ระยะเวลาเฟด", "vi": "Thời gian fade", "es": "Duración del fade"},
    "dialog.file_path": {"zh": "文件路径", "id": "Path File", "th": "ตำแหน่งไฟล์", "vi": "Đường dẫn tệp", "es": "Ruta del archivo"},
    "dialog.open_dir": {"zh": "打开目录", "id": "Buka Folder", "th": "เปิดโฟลเดอร์", "vi": "Mở thư mục", "es": "Abrir carpeta"},
    "dialog.assigned_tag": {"zh": "所属标签", "id": "Tag", "th": "แท็ก", "vi": "Thẻ", "es": "Etiqueta"},
    "dialog.no_tag": {"zh": "（无标签）", "id": "(Tanpa Tag)", "th": "(ไม่มีแท็ก)", "vi": "(Không có thẻ)", "es": "(Sin etiqueta)"},
    "dialog.save": {"zh": "保存", "id": "Simpan", "th": "บันทึก", "vi": "Lưu", "es": "Guardar"},
    "dialog.cancel": {"zh": "取消", "id": "Batal", "th": "ยกเลิก", "vi": "Hủy", "es": "Cancelar"},
    "dialog.tab_basic": {"zh": "基本设置", "id": "Dasar", "th": "พื้นฐาน", "vi": "Cơ bản", "es": "Básico"},
    "dialog.tab_hotkey": {"zh": "快捷键", "id": "Pintasan", "th": "ปุ่มลัด", "vi": "Phím tắt", "es": "Atajo"},
    "dialog.tab_clip": {"zh": "音效剪辑", "id": "Potong", "th": "ตัดเสียง", "vi": "Cắt", "es": "Recortar"},
    "dialog.tab_personal": {"zh": "个性化", "id": "Personal", "th": "ส่วนตัว", "vi": "Cá nhân", "es": "Personal"},
    "context.edit": {"zh": "编辑", "id": "Edit", "th": "แก้ไข", "vi": "Chỉnh sửa", "es": "Editar"},
    "context.delete": {"zh": "删除", "id": "Hapus", "th": "ลบ", "vi": "Xóa", "es": "Eliminar"},
    "context.clip": {"zh": "裁剪音效", "id": "Potong Efek", "th": "ตัดเสียง", "vi": "Cắt âm thanh", "es": "Recortar sonido"},
    "tags.rename": {"zh": "重命名", "id": "Ganti Nama", "th": "เปลี่ยนชื่อ", "vi": "Đổi tên", "es": "Renombrar"},
    "tags.delete": {"zh": "删除", "id": "Hapus", "th": "ลบ", "vi": "Xóa", "es": "Eliminar"},
    "tags.rename_prompt": {"zh": "重命名标签", "id": "Ganti Nama Tag", "th": "เปลี่ยนชื่อแท็ก", "vi": "Đổi tên thẻ", "es": "Renombrar etiqueta"},
    "tags.delete_confirm": {"zh": "删除标签“{name}”吗？", "id": "Hapus tag \"{name}\"?", "th": "ลบแท็ก \"{name}\" ใช่หรือไม่?", "vi": "Xóa thẻ \"{name}\"?", "es": "¿Eliminar la etiqueta \"{name}\"?"},
    "tags.menu.add": {"zh": "添加到标签", "id": "Tambahkan ke Tag", "th": "เพิ่มไปยังแท็ก", "vi": "Thêm vào thẻ", "es": "Añadir a etiqueta"},
    "tags.menu.remove_current": {"zh": "从当前标签移除", "id": "Hapus dari Tag Ini", "th": "นำออกจากแท็กนี้", "vi": "Xóa khỏi thẻ hiện tại", "es": "Quitar de esta etiqueta"},
    "hotkey_capture.title": {"zh": "录制快捷键", "id": "Rekam Pintasan", "th": "บันทึกปุ่มลัด", "vi": "Ghi phím tắt", "es": "Grabar atajo"},
    "hotkey_capture.hint": {"zh": "按 ESC 或空格取消录制", "id": "Tekan ESC atau Spasi untuk membatalkan", "th": "กด ESC หรือ Space เพื่อยกเลิก", "vi": "Nhấn ESC hoặc Space để hủy", "es": "Pulsa ESC o Espacio para cancelar"},
    "sound_edit.name": {"zh": "音效名称", "id": "Nama Efek", "th": "ชื่อเสียง", "vi": "Tên âm thanh", "es": "Nombre del sonido"},
    "sound_edit.color": {"zh": "卡片颜色", "id": "Warna Kartu", "th": "สีการ์ด", "vi": "Màu thẻ", "es": "Color de tarjeta"},
    "sound_edit.fade_in": {"zh": "淡入播放", "id": "Fade In Playback", "th": "เล่นแบบเฟดอิน", "vi": "Phát với fade in", "es": "Reproducción con fade in"},
    "sound_edit.record_new_hotkey": {"zh": "录制新快捷键", "id": "Rekam Pintasan Baru", "th": "บันทึกปุ่มลัดใหม่", "vi": "Ghi phím tắt mới", "es": "Grabar nuevo atajo"},
    "sound_edit.clear_hotkey": {"zh": "清除快捷键", "id": "Hapus Pintasan", "th": "ล้างปุ่มลัด", "vi": "Xóa phím tắt", "es": "Borrar atajo"},
    "sound_edit.hotkey_hint": {"zh": "按 ESC 或空格取消录制", "id": "Tekan ESC atau Spasi untuk membatalkan", "th": "กด ESC หรือ Space เพื่อยกเลิก", "vi": "Nhấn ESC atau Space để hủy", "es": "Pulsa ESC o Espacio para cancelar"},
    "sound_edit.preview_current_clip": {"zh": "> 预览当前片段", "id": "> Pratinjau Klip Saat Ini", "th": "> พรีวิวช่วงปัจจุบัน", "vi": "> Xem trước đoạn hiện tại", "es": "> Vista previa del clip actual"},
    "sound_edit.stop_preview": {"zh": "[] 停止", "id": "[] Hentikan", "th": "[] หยุด", "vi": "[] Dừng", "es": "[] Detener"},
    "sound_edit.clip_hint": {"zh": "拖动波形上的两个裁剪手柄以调整片段范围", "id": "Seret kedua pegangan trim pada gelombang untuk menyesuaikan klip", "th": "ลากจุดตัดทั้งสองบนคลื่นเสียงเพื่อปรับช่วงคลิป", "vi": "Kéo hai tay cắt trên dạng sóng để điều chỉnh đoạn cắt", "es": "Arrastra ambos controles de recorte en la forma de onda para ajustar el clip"},
    "sound_edit.loop_playback": {"zh": "循环播放（结束后重新开始）", "id": "Putar ulang (mulai lagi saat selesai)", "th": "เล่นซ้ำ (เริ่มใหม่เมื่อจบ)", "vi": "Phát lặp (phát lại khi kết thúc)", "es": "Reproducción en bucle (reiniciar al terminar)"},
    "bgm_edit.title": {"zh": "编辑 BGM - {name}", "id": "Edit BGM - {name}", "th": "แก้ไข BGM - {name}", "vi": "Chỉnh sửa BGM - {name}", "es": "Editar BGM - {name}"},
    "bgm_edit.basic": {"zh": "基本设置", "id": "Dasar", "th": "พื้นฐาน", "vi": "Cơ bản", "es": "Básico"},
    "bgm_edit.hotkey": {"zh": "快捷键", "id": "Pintasan", "th": "ปุ่มลัด", "vi": "Phím tắt", "es": "Atajo"},
    "bgm_edit.clip": {"zh": "裁剪", "id": "Potong", "th": "ตัด", "vi": "Cắt", "es": "Recortar"},
    "bgm_edit.personal": {"zh": "个性化", "id": "Personal", "th": "ส่วนตัว", "vi": "Cá nhân", "es": "Personal"},
    "bgm_edit.hotkey_hint": {"zh": "按下快捷键进行录制，按 ESC 取消", "id": "Tekan pintasan untuk merekam, ESC untuk batal", "th": "กดปุ่มลัดเพื่อบันทึก กด ESC เพื่อยกเลิก", "vi": "Nhấn phím tắt để ghi, ESC để hủy", "es": "Pulsa un atajo para grabar, ESC para cancelar"},
    "bgm_edit.clip_hint": {"zh": "拖动两端手柄调整 BGM 裁剪范围", "id": "Seret kedua pegangan gelombang untuk menyesuaikan klip BGM", "th": "ลากจุดทั้งสองด้านเพื่อปรับช่วงตัด BGM", "vi": "Kéo hai tay ở hai đầu để điều chỉnh đoạn cắt BGM", "es": "Arrastra ambos controles para ajustar el recorte del BGM"},
    "floating.mode_off": {"zh": "关闭", "id": "Mati", "th": "ปิด", "vi": "Tắt", "es": "Apagado"},
    "floating.mode_local": {"zh": "局部", "id": "Lokal", "th": "เฉพาะแอป", "vi": "Cục bộ", "es": "Local"},
    "floating.mode_global": {"zh": "全局", "id": "Global", "th": "ทั่วระบบ", "vi": "Toàn cục", "es": "Global"},
    "floating.hotkey_switch": {"zh": "快捷键：{mode}", "id": "Pintasan: {mode}", "th": "ปุ่มลัด: {mode}", "vi": "Phím tắt: {mode}", "es": "Atajos: {mode}"},
    "floating.no_switch_hotkey": {"zh": "未设置切换快捷键", "id": "Pintasan ganti belum diatur", "th": "ยังไม่ได้ตั้งปุ่มลัดสลับ", "vi": "Chưa đặt phím chuyển đổi", "es": "Atajo de cambio no configurado"},
    "status.audio_unavailable": {"zh": "音频设备不可用", "id": "Perangkat audio tidak tersedia", "th": "อุปกรณ์เสียงไม่พร้อมใช้งาน", "vi": "Thiết bị âm thanh không khả dụng", "es": "Dispositivo de audio no disponible"},
    "status.hotkey_error": {"zh": "快捷键注册失败", "id": "Gagal mendaftarkan pintasan", "th": "ลงทะเบียนปุ่มลัดไม่สำเร็จ", "vi": "Đăng ký phím tắt thất bại", "es": "Error al registrar atajo"},
    "status.hotkey_permission": {"zh": "全局快捷键需要更高权限", "id": "Pintasan global memerlukan izin lebih tinggi", "th": "ปุ่มลัดทั่วระบบต้องใช้สิทธิ์สูงกว่า", "vi": "Phím tắt toàn cục cần quyền cao hơn", "es": "Los atajos globales requieren permisos elevados"},
    "tray.show": {"zh": "显示主窗口", "id": "Tampilkan Jendela Utama", "th": "แสดงหน้าต่างหลัก", "vi": "Hiện cửa sổ chính", "es": "Mostrar ventana principal"},
    "tray.hide_floating": {"zh": "显示/隐藏悬浮窗", "id": "Tampilkan/Sembunyikan Jendela Mengambang", "th": "แสดง/ซ่อนหน้าต่างลอย", "vi": "Hiện/Ẩn cửa sổ nổi", "es": "Mostrar/Ocultar ventana flotante"},
    "tray.quit": {"zh": "退出", "id": "Keluar", "th": "ออก", "vi": "Thoát", "es": "Salir"},
    "tray.minimized_msg": {"zh": "程序已最小化到系统托盘。", "id": "Aplikasi telah diminimalkan ke baki sistem.", "th": "โปรแกรมถูกย่อไปยังถาดระบบแล้ว", "vi": "Ứng dụng đã được thu nhỏ xuống khay hệ thống.", "es": "La aplicación se minimizó a la bandeja del sistema."},
    "progress.importing_sounds": {"zh": "正在导入音效...", "id": "Mengimpor efek suara...", "th": "กำลังนำเข้าเสียง...", "vi": "Đang nhập âm thanh...", "es": "Importando sonidos..."},
    "progress.importing_bgm": {"zh": "正在导入背景音乐...", "id": "Mengimpor musik latar...", "th": "กำลังนำเข้าเพลงพื้นหลัง...", "vi": "Đang nhập nhạc nền...", "es": "Importando música de fondo..."},
    "progress.exporting": {"zh": "正在导出备份...", "id": "Mengekspor cadangan...", "th": "กำลังส่งออก...", "vi": "Đang xuất...", "es": "Exportando..."},
    "progress.importing_backup": {"zh": "正在导入备份...", "id": "Mengimpor cadangan...", "th": "กำลังนำเข้า...", "vi": "Đang nhập...", "es": "Importando respaldo..."},
}


def main() -> None:
    for lang_code in ("zh", "id", "th", "vi", "es"):
        path = I18N_DIR / f"{lang_code}.json"
        if not path.exists():
            print(f"WARNING: {path} not found")
            continue
        data = json.loads(path.read_text(encoding="utf-8-sig"))
        updated = 0
        for key, lang_map in TRANSLATIONS.items():
            value = lang_map.get(lang_code)
            if value is None:
                continue
            data[key] = value
            updated += 1
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {updated} keys updated")


if __name__ == "__main__":
    main()
