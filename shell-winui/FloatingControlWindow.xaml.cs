using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using WinRT.Interop;

namespace CodeXSoundboard.Shell.WinUI;

public sealed partial class FloatingControlWindow : Window
{
    public FloatingControlWindow()
    {
        InitializeComponent();

        var windowId = Microsoft.UI.Win32Interop.GetWindowIdFromWindow(WindowNative.GetWindowHandle(this));
        var appWindow = AppWindow.GetFromWindowId(windowId);
        if (appWindow is not null)
        {
            if (appWindow.Presenter is OverlappedPresenter presenter)
            {
                presenter.IsAlwaysOnTop = true;
            }

            appWindow.Resize(new Windows.Graphics.SizeInt32(360, 180));
        }
    }

    public void ApplyState(bool shortcutsEnabled, string playbackText, string toggleAccelerator, string playbackAccelerator)
    {
        FloatingStatusText.Text = shortcutsEnabled ? "全局快捷键已开启。" : "全局快捷键已暂停。";
        FloatingHotkeyStateText.Text = toggleAccelerator;
        FloatingPlaybackStateText.Text = string.IsNullOrWhiteSpace(playbackText)
            ? playbackAccelerator
            : playbackText;
    }
}
