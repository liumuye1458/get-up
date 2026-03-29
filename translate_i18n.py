"""
Batch-translate selected UI labels for id/th/vi/es.

Uses the actual flat key structure from i18n/en.json and overwrites
those keys in id.json / th.json / vi.json / es.json with curated translations.
Any key not listed here keeps its current value (usually English fallback).
"""
from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
I18N_DIR = ROOT / "i18n"


TRANSLATIONS: dict[str, dict[str, str]] = {
    "nav.sounds": {"id": "Efek Saya", "th": "เสียงของฉัน", "vi": "Âm Thanh Của Tôi", "es": "Mis Sonidos"},
    "nav.bgm": {"id": "Musik Latar", "th": "เพลงพื้นหลัง", "vi": "Nhạc Nền", "es": "Música de Fondo"},
    "nav.backup": {"id": "Cadangan & Pemulihan", "th": "สำรองและกู้คืน", "vi": "Sao Lưu & Khôi Phục", "es": "Respaldo y Restauración"},
    "nav.settings": {"id": "Pengaturan", "th": "ตั้งค่า", "vi": "Cài Đặt", "es": "Ajustes"},
    "nav.help": {"id": "Bantuan", "th": "ช่วยเหลือ", "vi": "Trợ Giúp", "es": "Ayuda"},
    "settings.title": {"id": "Pengaturan", "th": "ตั้งค่า", "vi": "Cài Đặt", "es": "Ajustes"},
    "settings.section.general": {"id": "Umum", "th": "ทั่วไป", "vi": "Chung", "es": "General"},
    "settings.language": {"id": "Bahasa", "th": "ภาษา", "vi": "Ngôn Ngữ", "es": "Idioma"},
    "settings.hotkey_mode": {"id": "Mode Pintasan", "th": "โหมดปุ่มลัด", "vi": "Chế Độ Phím Tắt", "es": "Modo de Atajos"},
    "settings.hotkey_global": {"id": "Mode global (aktif di mana saja)", "th": "โหมดทั่วไป (ใช้ได้ทุกที่)", "vi": "Chế độ toàn cục (hoạt động mọi nơi)", "es": "Modo global (funciona en todas partes)"},
    "settings.hotkey_local": {"id": "Mode lokal (hanya saat jendela aktif)", "th": "โหมดเฉพาะที่ (เฉพาะเมื่อโฟกัสหน้าต่าง)", "vi": "Chế độ cục bộ (chỉ khi cửa sổ được chọn)", "es": "Modo local (solo cuando la ventana está enfocada)"},
    "settings.section.device": {"id": "Perangkat Output", "th": "อุปกรณ์เอาต์พุต", "vi": "Thiết Bị Đầu Ra", "es": "Dispositivo de Salida"},
    "settings.section.func_hotkeys": {"id": "Pintasan Fungsi", "th": "ปุ่มลัดฟังก์ชัน", "vi": "Phím Tắt Chức Năng", "es": "Teclas de Función"},
    "settings.section.floating": {"id": "Jendela Mengambang", "th": "หน้าต่างลอย", "vi": "Cửa Sổ Nổi", "es": "Ventana Flotante"},
    "settings.show_floating": {"id": "Tampilkan jendela mengambang", "th": "แสดงหน้าต่างลอย", "vi": "Hiện cửa sổ nổi", "es": "Mostrar ventana flotante"},
    "settings.hotkey.stop_all": {"id": "Hentikan semua suara", "th": "หยุดเสียงทั้งหมด", "vi": "Dừng tất cả âm thanh", "es": "Detener todos los sonidos"},
    "settings.hotkey.bgm_play_pause": {"id": "BGM putar/jeda", "th": "BGM เล่น/หยุด", "vi": "BGM phát/tạm dừng", "es": "BGM reproducir/pausar"},
    "settings.hotkey.bgm_vol_up": {"id": "BGM volume naik", "th": "BGM เพิ่มเสียง", "vi": "BGM tăng âm lượng", "es": "BGM subir volumen"},
    "settings.hotkey.bgm_vol_down": {"id": "BGM volume turun", "th": "BGM ลดเสียง", "vi": "BGM giảm âm lượng", "es": "BGM bajar volumen"},
    "settings.hotkey.stop_all_music": {"id": "Hentikan semua musik", "th": "หยุดเพลงทั้งหมด", "vi": "Dừng tất cả nhạc", "es": "Detener toda la música"},
    "settings.hotkey.toggle_window": {"id": "Minimalkan/tampilkan jendela", "th": "ย่อ/แสดงหน้าต่าง", "vi": "Thu nhỏ/hiện cửa sổ", "es": "Minimizar/mostrar ventana"},
    "settings.hotkey.toggle_floating": {"id": "Tampilkan/sembunyikan jendela mengambang", "th": "แสดง/ซ่อนหน้าต่างลอย", "vi": "Hiện/ẩn cửa sổ nổi", "es": "Mostrar/ocultar ventana flotante"},
    "settings.hotkey_unset": {"id": "Belum diatur", "th": "ยังไม่ตั้ง", "vi": "Chưa đặt", "es": "No configurado"},
    "settings.record": {"id": "Rekam", "th": "บันทึก", "vi": "Ghi", "es": "Grabar"},
    "settings.clear": {"id": "Hapus", "th": "ล้าง", "vi": "Xóa", "es": "Borrar"},
    "bottom.output_short": {"id": "Output", "th": "เอาต์พุต", "vi": "Đầu Ra", "es": "Salida"},
    "sounds.import": {"id": "+ Tambah Efek", "th": "+ เพิ่มเสียง", "vi": "+ Thêm Âm Thanh", "es": "+ Añadir Sonidos"},
    "sounds.search.placeholder": {"id": "Cari nama suara, tag, pintasan...", "th": "ค้นหาชื่อเสียง, แท็ก, ปุ่มลัด...", "vi": "Tìm tên âm thanh, thẻ, phím tắt...", "es": "Buscar nombres, etiquetas, atajos..."},
    "sounds.tag.all": {"id": "Semua", "th": "ทั้งหมด", "vi": "Tất Cả", "es": "Todos"},
    "sounds.add_tag": {"id": "+ Tag Baru", "th": "+ แท็กใหม่", "vi": "+ Thẻ Mới", "es": "+ Nueva Etiqueta"},
    "bgm.title": {"id": "Musik Latar", "th": "เพลงพื้นหลัง", "vi": "Nhạc Nền", "es": "Música de Fondo"},
    "bgm.add": {"id": "+ Impor Musik Latar", "th": "+ นำเข้าเพลงพื้นหลัง", "vi": "+ Nhập Nhạc Nền", "es": "+ Importar Música de Fondo"},
    "bgm.search.placeholder": {"id": "Cari musik latar...", "th": "ค้นหาเพลงพื้นหลัง...", "vi": "Tìm nhạc nền...", "es": "Buscar música de fondo..."},
    "backup.title": {"id": "Cadangan & Pemulihan", "th": "สำรองและกู้คืน", "vi": "Sao Lưu & Khôi Phục", "es": "Respaldo y Restauración"},
    "backup.export_button": {"id": "Ekspor Cadangan...", "th": "ส่งออกข้อมูลสำรอง...", "vi": "Xuất Bản Sao Lưu...", "es": "Exportar Respaldo..."},
    "backup.import_button": {"id": "Impor Cadangan...", "th": "นำเข้าข้อมูลสำรอง...", "vi": "Nhập Bản Sao Lưu...", "es": "Importar Respaldo..."},
    "common.open_folder": {"id": "Buka Folder", "th": "เปิดโฟลเดอร์", "vi": "Mở Thư Mục", "es": "Abrir Carpeta"},
    "common.cancel": {"id": "Batal", "th": "ยกเลิก", "vi": "Hủy", "es": "Cancelar"},
    "progress.importing_sounds": {"id": "Mengimpor efek suara...", "th": "กำลังนำเข้าเสียง...", "vi": "Đang nhập âm thanh...", "es": "Importando sonidos..."},
    "progress.importing_bgm": {"id": "Mengimpor musik latar...", "th": "กำลังนำเข้าเพลงพื้นหลัง...", "vi": "Đang nhập nhạc nền...", "es": "Importando música de fondo..."},
    "progress.exporting": {"id": "Mengekspor cadangan...", "th": "กำลังส่งออกข้อมูลสำรอง...", "vi": "Đang xuất bản sao lưu...", "es": "Exportando respaldo..."},
    "progress.importing_backup": {"id": "Mengimpor cadangan...", "th": "กำลังนำเข้าข้อมูลสำรอง...", "vi": "Đang nhập bản sao lưu...", "es": "Importando respaldo..."},
    "backup.export_progress": {"id": "Mengekspor cadangan...", "th": "กำลังส่งออกข้อมูลสำรอง...", "vi": "Đang xuất bản sao lưu...", "es": "Exportando respaldo..."},
    "backup.import_progress": {"id": "Mengimpor cadangan...", "th": "กำลังนำเข้าข้อมูลสำรอง...", "vi": "Đang nhập bản sao lưu...", "es": "Importando respaldo..."},
    "bgm.import_progress": {"id": "Mengimpor musik latar...", "th": "กำลังนำเข้าเพลงพื้นหลัง...", "vi": "Đang nhập nhạc nền...", "es": "Importando música de fondo..."},
}


def main() -> None:
    for lang_code in ("id", "th", "vi", "es"):
        file_path = I18N_DIR / f"{lang_code}.json"
        if not file_path.exists():
            print(f"WARNING: {file_path} not found, skipping")
            continue

        data = json.loads(file_path.read_text(encoding="utf-8-sig"))
        updated = 0
        for key, lang_map in TRANSLATIONS.items():
            value = lang_map.get(lang_code)
            if value is None:
                continue
            data[key] = value
            updated += 1

        file_path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"{lang_code}.json: {updated} keys translated")

    print("\nDone!")


if __name__ == "__main__":
    main()
