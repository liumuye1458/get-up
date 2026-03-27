using CodeXSoundboard.Shell.WinUI.Bootstrap;
using CodeXSoundboard.Shell.WinUI.Core;
using Microsoft.UI;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Controls.Primitives;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Media;
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using WinRT.Interop;
using Windows.ApplicationModel.DataTransfer;
using Windows.Storage;
using Windows.System;

namespace CodeXSoundboard.Shell.WinUI
{
    public sealed partial class MainWindow : Window
    {
        private const uint WmGetMinMaxInfo = 0x0024;
        private const uint WmDropFiles = 0x0233;
        private const uint WmHotKey = 0x0312;
        private const uint ModAlt = 0x0001;
        private const uint ModControl = 0x0002;
        private const uint ModShift = 0x0004;
        private const uint ModNoRepeat = 0x4000;
        private const double DefaultCueVolumePercent = 100;
        private const double DefaultCuePlaybackRate = 1.0;
        private const double CuePlaybackRateStep = 0.05;
        private const double DefaultMasterVolumePercent = 76;
        private const double TrimSnapStepSeconds = 0.01;
        private const double MinimumTrimDurationSeconds = 0.05;
        private const double DefaultTrimStartSeconds = 0.0;
        private const double DefaultTrimEndSeconds = 2.4;
        private const double DefaultCueTotalDurationSeconds = 2.4;
        private const int MaxCueNameLength = 48;
        private static readonly string[] CardColorCycle = ["slate", "red", "orange", "amber", "lime", "emerald", "sky", "indigo", "rose"];

        private readonly ObservableCollection<CueCardStub> _visibleCueCards = new ObservableCollection<CueCardStub>();
        private readonly PlaybackService _playbackService = new PlaybackService();
        private readonly SoundboardRepository _repository = new SoundboardRepository();
        private readonly List<CueCardSeed> _allCueCards = new List<CueCardSeed>
        {
            new CueCardSeed("cue-01", CueCardKind.Imported, "Entrance hit", "Ctrl+1", "sky", string.Empty, "entrance-hit.wav", DefaultCueTotalDurationSeconds, "Opening", "Hype"),
            new CueCardSeed("cue-02", CueCardKind.Imported, "Laughter", "Ctrl+2", "amber", string.Empty, "laughter.wav", DefaultCueTotalDurationSeconds, "Reaction", "Comedy"),
            new CueCardSeed("cue-03", CueCardKind.Imported, "Applause", "Ctrl+3", "emerald", string.Empty, "applause.wav", DefaultCueTotalDurationSeconds, "Reaction", "Crowd"),
            new CueCardSeed("cue-04", CueCardKind.Imported, "Transition", "Ctrl+4", "indigo", string.Empty, "transition.wav", DefaultCueTotalDurationSeconds, "Scene", "Utility"),
            new CueCardSeed("cue-05", CueCardKind.Imported, "Fail cue", "Ctrl+5", "red", string.Empty, "fail-cue.wav", DefaultCueTotalDurationSeconds, "Game", "Reaction"),
            new CueCardSeed("cue-06", CueCardKind.Imported, "Countdown", "Ctrl+6", "lime", string.Empty, "countdown.wav", DefaultCueTotalDurationSeconds, "Utility", "Timing"),
            new CueCardSeed("cue-07", CueCardKind.Imported, "High energy", "Ctrl+7", "orange", string.Empty, "high-energy.wav", DefaultCueTotalDurationSeconds, "Opening", "Hype"),
            new CueCardSeed("cue-08", CueCardKind.Imported, "Fill silence", "Ctrl+8", "rose", string.Empty, "fill-silence.wav", DefaultCueTotalDurationSeconds, "Utility", "Talk"),
            new CueCardSeed("cue-09", CueCardKind.Placeholder, "Reserved slot", "--", "slate"),
            new CueCardSeed("cue-10", CueCardKind.Placeholder, "Reserved slot", "--", "slate"),
        };

        private readonly ShellLayoutProfile _layoutProfile;
        private AppWindow? _appWindow;
        private nint _windowHandle;
        private SubclassProc? _windowSubclassProc;
        private readonly Dictionary<string, string> _savedTitleOverrides = new Dictionary<string, string>(StringComparer.Ordinal);
        private readonly Dictionary<string, string> _draftTitleOverrides = new Dictionary<string, string>(StringComparer.Ordinal);
        private readonly Dictionary<string, string[]> _savedTagsOverrides = new Dictionary<string, string[]>(StringComparer.Ordinal);
        private readonly Dictionary<string, string[]> _draftTagsOverrides = new Dictionary<string, string[]>(StringComparer.Ordinal);
        private readonly Dictionary<string, string> _savedColorOverrides = new Dictionary<string, string>(StringComparer.Ordinal);
        private readonly Dictionary<string, string> _draftColorOverrides = new Dictionary<string, string>(StringComparer.Ordinal);
        private readonly Dictionary<string, string> _savedHotkeyOverrides = new Dictionary<string, string>(StringComparer.Ordinal);
        private readonly Dictionary<string, string> _draftHotkeyOverrides = new Dictionary<string, string>(StringComparer.Ordinal);
        private readonly Dictionary<string, double> _savedCueVolumeOverrides = new Dictionary<string, double>(StringComparer.Ordinal);
        private readonly Dictionary<string, double> _draftCueVolumeOverrides = new Dictionary<string, double>(StringComparer.Ordinal);
        private readonly Dictionary<string, double> _savedCuePlaybackRateOverrides = new Dictionary<string, double>(StringComparer.Ordinal);
        private readonly Dictionary<string, double> _draftCuePlaybackRateOverrides = new Dictionary<string, double>(StringComparer.Ordinal);
        private readonly Dictionary<string, TrimRange> _savedTrimOverrides = new Dictionary<string, TrimRange>(StringComparer.Ordinal);
        private readonly Dictionary<string, TrimRange> _draftTrimOverrides = new Dictionary<string, TrimRange>(StringComparer.Ordinal);
        private readonly Dictionary<string, string> _registeredGlobalHotkeys = new Dictionary<string, string>(StringComparer.Ordinal);
        private readonly Dictionary<string, int> _registeredHotkeyIdsByCueId = new Dictionary<string, int>(StringComparer.Ordinal);
        private readonly Dictionary<int, string> _registeredCueIdsByHotkeyId = new Dictionary<int, string>();
        private readonly List<string> _historyEntries = new List<string>();
        private bool _isPlaying;
        private bool _globalHotkeysEnabled = true;
        private bool _repeatPlaybackEnabled;
        private double _masterVolumePercent = DefaultMasterVolumePercent;
        private double _activeCueSessionVolumePercent = DefaultCueVolumePercent;
        private double _activeCueSessionPlaybackRate = DefaultCuePlaybackRate;
        private double _activeCueSessionTrimStartSeconds = DefaultTrimStartSeconds;
        private double _activeCueSessionTrimEndSeconds = DefaultTrimEndSeconds;
        private string _activePlayingCueId = string.Empty;
        private string _searchQuery = string.Empty;
        private string _selectedTag = string.Empty;
        private string _editingCueId = string.Empty;
        private bool _isApplyingEditorState;
        private bool _isRecordingHotkey;
        private bool _isBasicInfoValid = true;
        private bool _isTrimValid = true;
        private bool _isHotkeyValid = true;
        private bool _isBasicInfoDirty;
        private bool _isHotkeyDirty;
        private bool _isTrimDirty;
        private bool _isPlaybackParamsDirty;
        private bool _showSavedHeaderState;
        private bool _isApplyingBottomControlState;
        private int _globalHotkeyRegistrationRevision;
        private double _lastValidTrimStartSeconds = DefaultTrimStartSeconds;
        private double _lastValidTrimEndSeconds = DefaultTrimEndSeconds;
        private TrimDragHandle _activeTrimDragHandle = TrimDragHandle.None;
        private bool IsEditorDrawerOpen => EditorDrawer != null && EditorDrawer.Visibility == Visibility.Visible;

        public MainWindow(ShellLayoutProfile layoutProfile)
        {
            _layoutProfile = layoutProfile;
            InitializeComponent();
            _repository.InitializeAsync().GetAwaiter().GetResult();
            _playbackService.PlaybackStateChanged += PlaybackService_PlaybackStateChanged;
            CueGrid.ItemsSource = _visibleCueCards;
            LoadCueCards(string.Empty);
            ConfigureWindowChrome();
            RebuildGlobalHotkeyRegistrations();
            InitializeBottomPlaybackControls();
            UpdateStatusHint(null);
            Closed += MainWindow_Closed;
        }

        private void ConfigureWindowChrome()
        {
            _windowHandle = WindowNative.GetWindowHandle(this);
            var windowId = Microsoft.UI.Win32Interop.GetWindowIdFromWindow(_windowHandle);
            _appWindow = AppWindow.GetFromWindowId(windowId);

            if (_appWindow != null)
            {
                _appWindow.Resize(new Windows.Graphics.SizeInt32(
                    ScaleLogicalWidth(_layoutProfile.DefaultWindowWidthLogical),
                    ScaleLogicalHeight(_layoutProfile.DefaultWindowHeightLogical)));
            }

            _windowSubclassProc = HandleWindowMessage;
            SetWindowSubclass(_windowHandle, _windowSubclassProc, 1, nuint.Zero);
            DragAcceptFiles(_windowHandle, true);
        }

        private void OpenEditorDrawerShell(string cueId)
        {
            if (string.IsNullOrWhiteSpace(cueId))
            {
                return;
            }

            _editingCueId = cueId;
            ApplyEditorState(cueId);

            if (EditorDrawerBodyScrollViewer != null)
            {
                EditorDrawerBodyScrollViewer.ChangeView(null, 0, null, true);
            }

            if (EditorDrawer != null)
            {
                EditorDrawer.Visibility = Visibility.Visible;
            }

            UpdateDrawerHeaderState();
        }

        private void CloseEditorDrawerShell()
        {
            _editingCueId = string.Empty;

            if (EditorDrawerBodyScrollViewer != null)
            {
                EditorDrawerBodyScrollViewer.ChangeView(null, 0, null, true);
            }

            if (EditorDrawer != null)
            {
                EditorDrawer.Visibility = Visibility.Collapsed;
            }

            UpdateDrawerHeaderState();
        }

        private void InitializeBottomPlaybackControls()
        {
            _isApplyingBottomControlState = true;

            if (GlobalHotkeyToggle != null)
            {
                GlobalHotkeyToggle.IsOn = _globalHotkeysEnabled;
            }

            if (RepeatPlaybackToggle != null)
            {
                RepeatPlaybackToggle.IsOn = _repeatPlaybackEnabled;
            }

            if (VolumeSlider != null)
            {
                VolumeSlider.Value = _masterVolumePercent;
            }

            _isApplyingBottomControlState = false;
            _playbackService.SetGlobalVolume(_masterVolumePercent / 100d);
            _playbackService.SetRepeatPlayback(_repeatPlaybackEnabled);
            RefreshBottomPlaybackControls();
        }

        private void RefreshBottomPlaybackControls()
        {
            if (PlayPauseButton != null)
            {
                PlayPauseButton.Content = _isPlaying ? "Pause" : "Play";
            }

            if (MasterVolumeValueText != null)
            {
                MasterVolumeValueText.Text = Math.Round(_masterVolumePercent).ToString("0", CultureInfo.InvariantCulture) + "%";
            }
        }

        private string BuildDefaultStatusHint()
        {
            if (_isPlaying && !string.IsNullOrWhiteSpace(_activePlayingCueId))
            {
                return "Playback active. Current session uses "
                    + Math.Round(_activeCueSessionVolumePercent).ToString("0", CultureInfo.InvariantCulture)
                    + "% at "
                    + FormatPlaybackRate(_activeCueSessionPlaybackRate)
                    + ".";
            }

            return "Bottom controls ready: global hotkeys, play/pause, volume, repeat, and status hint.";
        }

        private void LoadCueCards(string query, bool refreshTagFilterPanel = true)
        {
            _searchQuery = query ?? string.Empty;

            var importedCards = _allCueCards
                .Where(card => card.Kind == CueCardKind.Imported)
                .Where(card => string.IsNullOrWhiteSpace(_selectedTag)
                    || GetEffectiveTags(card).Any(tag => string.Equals(tag, _selectedTag, StringComparison.OrdinalIgnoreCase)))
                .Where(card => string.IsNullOrWhiteSpace(_searchQuery)
                    || GetEffectiveTitle(card).Contains(_searchQuery, StringComparison.CurrentCultureIgnoreCase)
                    || GetEffectiveHotkeyDisplay(card).Contains(_searchQuery, StringComparison.CurrentCultureIgnoreCase)
                    || GetEffectiveTags(card).Any(tag => tag.Contains(_searchQuery, StringComparison.CurrentCultureIgnoreCase)))
                .ToList();

            _visibleCueCards.Clear();
            foreach (var card in importedCards)
            {
                _visibleCueCards.Add(BuildImportedCard(card));
            }

            if (string.IsNullOrWhiteSpace(_searchQuery) && importedCards.Count > 0)
            {
                foreach (var placeholder in _allCueCards.Where(card => card.Kind == CueCardKind.Placeholder))
                {
                    _visibleCueCards.Add(BuildPlaceholderCard(placeholder));
                }
            }

            if (refreshTagFilterPanel)
            {
                BuildTagFilterPanel();
            }

            EmptyStatePanel.Visibility = importedCards.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
            EmptyStateText.Text = string.IsNullOrWhiteSpace(_searchQuery)
                ? "No imported cue cards"
                : "No matching imported cue cards";
        }

        private void SearchBox_TextChanged(object sender, TextChangedEventArgs args)
        {
            var textBox = sender as TextBox;
            LoadCueCards(textBox != null ? textBox.Text : string.Empty, refreshTagFilterPanel: false);
            UpdateStatusHint(null);
        }

        private void CueGridHost_DragOver(object sender, DragEventArgs e)
        {
            if (e.DataView.Contains(StandardDataFormats.StorageItems))
            {
                e.AcceptedOperation = DataPackageOperation.Copy;
                e.Handled = true;
            }
        }

        private async void CueGridHost_Drop(object sender, DragEventArgs e)
        {
            if (!e.DataView.Contains(StandardDataFormats.StorageItems))
            {
                UpdateStatusHint("Drop audio files onto the card area to import them");
                return;
            }

            var storageItems = await e.DataView.GetStorageItemsAsync();
            var importedFilePaths = storageItems
                .OfType<StorageFile>()
                .Select(file => file.Path)
                .Where(IsSupportedAudioFilePath)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (importedFilePaths.Count == 0)
            {
                UpdateStatusHint("No supported audio files were dropped");
                return;
            }

            ImportAudioFilePaths(importedFilePaths, "Imported ", "Dropped audio files could not be imported");
        }

        private async void CueCard_Tapped(object sender, TappedRoutedEventArgs e)
        {
            var element = sender as FrameworkElement;
            var cueCard = element?.DataContext as CueCardStub;
            if (cueCard == null)
            {
                return;
            }

            if (!cueCard.IsInteractive)
            {
                return;
            }

            _activePlayingCueId = cueCard.Id;
            var cueSeed = _allCueCards.FirstOrDefault(card => string.Equals(card.Id, cueCard.Id, StringComparison.Ordinal));
            if (cueSeed != null)
            {
                await TryPlayCueAsync(cueSeed, "Left click plays ");
            }
        }

        private async void CueCard_RightTapped(object sender, RightTappedRoutedEventArgs e)
        {
            var element = sender as FrameworkElement;
            var cueCard = element?.DataContext as CueCardStub;
            if (cueCard == null || !cueCard.IsInteractive)
            {
                return;
            }

            var isSwitchingCue = !string.Equals(_editingCueId, cueCard.Id, StringComparison.Ordinal);
            if (isSwitchingCue
                && HasUnsavedChanges()
                && !await ConfirmDiscardChangesAsync())
            {
                UpdateStatusHint("Cue switch cancelled; unsaved changes remain on the current card");
                return;
            }

            var refreshTagFilterPanel = isSwitchingCue && HasPendingTagChanges(_editingCueId);
            if (isSwitchingCue && HasUnsavedChanges())
            {
                DiscardPendingDrawerChanges(_editingCueId);
            }

            OpenEditorDrawerShell(cueCard.Id);
            LoadCueCards(_searchQuery, refreshTagFilterPanel);
            UpdateStatusHint("Right click opens editor for " + cueCard.Title);
        }

        private void AllCardsFilterButton_Click(object sender, RoutedEventArgs e)
        {
            _selectedTag = string.Empty;
            LoadCueCards(_searchQuery, refreshTagFilterPanel: false);
            RefreshTagFilterSelectionState();
            UpdateStatusHint(string.IsNullOrWhiteSpace(_searchQuery)
                ? "Tag filter cleared: all cue cards"
                : "Tag filter cleared: search remains active");
        }

        private void TagFilterButton_Click(object sender, RoutedEventArgs e)
        {
            var button = sender as Button;
            var tagName = button?.Tag as string;
            if (string.IsNullOrWhiteSpace(tagName))
            {
                return;
            }

            _selectedTag = string.Equals(_selectedTag, tagName, StringComparison.OrdinalIgnoreCase)
                ? string.Empty
                : tagName;

            LoadCueCards(_searchQuery, refreshTagFilterPanel: false);
            RefreshTagFilterSelectionState();
            UpdateStatusHint(string.IsNullOrWhiteSpace(_selectedTag)
                ? "Tag filter cleared"
                : "Tag filter: " + _selectedTag);
        }

        private async void CloseDrawerButton_Click(object sender, RoutedEventArgs e)
        {
            if (HasUnsavedChanges() && !await ConfirmDiscardChangesAsync())
            {
                UpdateStatusHint("Close cancelled; unsaved changes remain in the drawer");
                return;
            }

            ResetDrawerSaveStateFlags();
            var closingCueId = _editingCueId;
            var refreshTagFilterPanel = HasPendingTagChanges(closingCueId);
            DiscardBasicInfoDraft(closingCueId);
            DiscardHotkeyDraft(closingCueId);
            DiscardPlaybackParametersDraft(closingCueId);
            DiscardTrimDraft(closingCueId);
            ExitHotkeyRecording();
            CloseEditorDrawerShell();
            LoadCueCards(_searchQuery, refreshTagFilterPanel);
            UpdateStatusHint("Editor drawer closed");
        }

        private void SaveCueButton_Click(object sender, RoutedEventArgs e)
        {
            if (SaveCueButton != null && !SaveCueButton.IsEnabled)
            {
                UpdateStatusHint(!_isTrimValid
                    ? "Save is blocked until trim boundaries return to a legal range"
                    : (!_isHotkeyValid
                        ? "Save is blocked until the hotkey assignment is valid"
                        : "Save is blocked until the cue name becomes valid"));
                return;
            }

            var hadPlaybackParameterChanges = _isPlaybackParamsDirty;
            var hadTrimChanges = _isTrimDirty;
            var hadHotkeyChanges = _isHotkeyDirty;
            var editingCueSeed = _allCueCards.FirstOrDefault(card => string.Equals(card.Id, _editingCueId, StringComparison.Ordinal));
            var refreshTagFilterPanel = HasPendingTagChanges(_editingCueId);
            CommitBasicInfoDraft(_editingCueId);
            CommitHotkeyDraft(_editingCueId);
            CommitPlaybackParametersDraft(_editingCueId);
            CommitTrimDraft(_editingCueId);
            if (editingCueSeed != null && string.Equals(_activePlayingCueId, _editingCueId, StringComparison.Ordinal))
            {
                if (hadPlaybackParameterChanges)
                {
                    ApplyCuePlaybackParametersToActiveSession(editingCueSeed);
                }

                if (hadTrimChanges && !_isPlaying)
                {
                    ApplyCueTrimRangeToActiveSession(editingCueSeed);
                }
            }

            _historyEntries.Add("Save:" + _editingCueId);
            ExitHotkeyRecording();
            var cueName = string.IsNullOrWhiteSpace(CueNameTextBox.Text) ? "current cue" : CueNameTextBox.Text;
            MarkDrawerSaved();
            LoadCueCards(_searchQuery, refreshTagFilterPanel);
            if (hadTrimChanges)
            {
                UpdateStatusHint(IsEditingCurrentPlayingCue()
                    ? "Save applied for " + cueName + "; trim is committed and affects the next trigger while current playback keeps its existing range"
                    : "Save applied for " + cueName + "; trim is committed for future playback");
            }
            else if (hadPlaybackParameterChanges)
            {
                UpdateStatusHint("Save applied for " + cueName + "; playback parameters are committed and current playback keeps the live preview");
            }
            else if (hadHotkeyChanges)
            {
                UpdateStatusHint("Save applied for " + cueName + "; global hotkey registration rebuilds now and affects future triggers only");
            }
            else
            {
                UpdateStatusHint("Save applied for " + cueName);
            }
        }

        private void CueNameTextBox_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(_editingCueId))
            {
                return;
            }

            if (_isApplyingEditorState)
            {
                return;
            }

            UpdateBasicInfoEditingState();

            if (_isBasicInfoValid)
            {
                LoadCueCards(_searchQuery, refreshTagFilterPanel: false);
                UpdateStatusHint("Basic info preview updated; card title and color reflect pending edits until Save");
                return;
            }

            UpdateStatusHint("Cue name cannot be empty; Save is blocked until the name is valid");
        }

        private void CueTagsTextBox_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(_editingCueId))
            {
                return;
            }

            if (_isApplyingEditorState)
            {
                return;
            }

            UpdateBasicInfoEditingState();
            var refreshTagFilterPanel = HasPendingTagChanges(_editingCueId);

            LoadCueCards(_searchQuery, refreshTagFilterPanel);
            UpdateStatusHint("Tag preview updated in the drawer; Save commits tag changes to the cue");
        }

        private void ColorButton_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(_editingCueId))
            {
                return;
            }

            var button = sender as Button;
            var colorKey = button?.Tag as string;
            if (string.IsNullOrWhiteSpace(colorKey))
            {
                return;
            }

            var cueSeed = _allCueCards.FirstOrDefault(card => string.Equals(card.Id, _editingCueId, StringComparison.Ordinal));
            if (cueSeed == null)
            {
                return;
            }

            SetDraftColor(cueSeed, colorKey);
            SyncBasicInfoDirtyState(cueSeed);
            UpdateBasicInfoEditorState();
            LoadCueCards(_searchQuery, refreshTagFilterPanel: false);
            UpdateStatusHint("Color preview updated; Save commits the new cue accent");
        }

        private void RecordHotkeyButton_Click(object sender, RoutedEventArgs e)
        {
            if (_isRecordingHotkey)
            {
                ExitHotkeyRecording();
                UpdateHotkeyEditorState();
                UpdateStatusHint("Hotkey recording cancelled");
                return;
            }

            _isRecordingHotkey = true;
            CueHotkeyTextBox.Text = "Listening for shortcut...";
            RecordHotkeyButton.Content = "Cancel recording";
            HotkeyStateText.Text = "Recording: press Ctrl, Alt, or Shift with A-Z, 0-9, or F1-F12. Press Esc to cancel.";
            HotkeyValidationText.Visibility = Visibility.Collapsed;
            CueHotkeyTextBox.Focus(FocusState.Programmatic);
            UpdateStatusHint("Hotkey recording started");
        }

        private void ClearHotkeyButton_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(_editingCueId))
            {
                return;
            }

            var cueSeed = _allCueCards.FirstOrDefault(card => string.Equals(card.Id, _editingCueId, StringComparison.Ordinal));
            if (cueSeed == null)
            {
                return;
            }

            ExitHotkeyRecording();
            SetDraftHotkey(cueSeed, string.Empty);
            _isHotkeyValid = true;
            HotkeyValidationText.Visibility = Visibility.Collapsed;
            HotkeyStateText.Text = "Hotkey cleared in the editor. Save removes global registration for this cue.";
            SyncHotkeyDirtyState(cueSeed);
            UpdateHotkeyEditorState();
            LoadCueCards(_searchQuery, refreshTagFilterPanel: false);
            UpdateStatusHint("Hotkey cleared in the editor; Save is required before global registration changes");
        }

        private void CueHotkeyTextBox_KeyDown(object sender, KeyRoutedEventArgs e)
        {
            if (!_isRecordingHotkey || string.IsNullOrWhiteSpace(_editingCueId))
            {
                return;
            }

            if (e.Key == VirtualKey.Escape)
            {
                ExitHotkeyRecording();
                UpdateHotkeyEditorState();
                UpdateStatusHint("Hotkey recording cancelled");
                e.Handled = true;
                return;
            }

            var display = TryBuildCapturedHotkeyDisplay(e.Key);
            if (display == null)
            {
                HotkeyValidationText.Text = "Use Ctrl, Alt, or Shift with a letter, digit, or function key. Single-key shortcuts are not allowed.";
                HotkeyValidationText.Visibility = Visibility.Visible;
                HotkeyStateText.Text = "Recording remains active until a valid combination is captured or cancelled.";
                e.Handled = true;
                return;
            }

            var cueSeed = _allCueCards.FirstOrDefault(card => string.Equals(card.Id, _editingCueId, StringComparison.Ordinal));
            if (cueSeed == null)
            {
                e.Handled = true;
                return;
            }

            SetDraftHotkey(cueSeed, display);
            ExitHotkeyRecording();

            if (TryFindHotkeyConflict(_editingCueId, display, out var conflictTitle))
            {
                _isHotkeyValid = false;
                HotkeyValidationText.Text = "Conflict: " + display + " is already used by " + conflictTitle + ". Save is disabled until the conflict is resolved.";
                HotkeyValidationText.Visibility = Visibility.Visible;
                HotkeyStateText.Text = "Conflict detected during capture. The pending shortcut remains visible for review.";
            }
            else
            {
                _isHotkeyValid = true;
                HotkeyValidationText.Visibility = Visibility.Collapsed;
                HotkeyStateText.Text = "Pending hotkey change. Save rebuilds global registration for future triggers.";
            }

            SyncHotkeyDirtyState(cueSeed);
            UpdateHotkeyEditorState();
            LoadCueCards(_searchQuery, refreshTagFilterPanel: false);
            UpdateSaveAvailability();
            UpdateStatusHint(_isHotkeyValid
                ? "Hotkey preview updated; current playback is unchanged and the new shortcut activates after Save"
                : "Hotkey conflict detected during capture; Save is blocked");
            e.Handled = true;
        }

        private void ToggleTrimSectionButton_Click(object sender, RoutedEventArgs e)
        {
            var isExpanding = TrimSectionContent.Visibility != Visibility.Visible;
            TrimSectionContent.Visibility = isExpanding ? Visibility.Visible : Visibility.Collapsed;
            TrimSectionToggleButton.Content = isExpanding ? "Collapse" : "Expand";
            TrimSectionHintText.Text = isExpanding
                ? "Expanded content uses fixed internal height blocks. If space runs out, the drawer body scrolls."
                : "Collapsed by default. Expand only when trim editing is needed.";
            UpdateStatusHint(isExpanding
                ? "Trim and waveform stay secondary and open on demand"
                : "Trim and waveform returned to collapsed state");
        }

        private void CueVolumeSlider_ValueChanged(object sender, RangeBaseValueChangedEventArgs e)
        {
            if (CueVolumeValueText == null)
            {
                return;
            }

            CueVolumeValueText.Text = Math.Round(e.NewValue).ToString("0", CultureInfo.InvariantCulture) + "%";
            if (_isApplyingEditorState)
            {
                return;
            }

            var cueSeed = _allCueCards.FirstOrDefault(card => string.Equals(card.Id, _editingCueId, StringComparison.Ordinal));
            if (cueSeed == null)
            {
                return;
            }

            var normalizedVolume = NormalizeCueVolumePercent(e.NewValue);
            SetDraftCueVolume(cueSeed, normalizedVolume);
            SyncPlaybackParametersDirtyState(cueSeed);

            var appliesToCurrentPlayback = IsEditingCurrentPlayingCue();
            if (appliesToCurrentPlayback)
            {
                ApplyCuePlaybackParametersToActiveSession(cueSeed);
            }

            UpdateStatusHint(appliesToCurrentPlayback
                ? "Volume preview updated to " + CueVolumeValueText.Text + "; current playback follows immediately, Save writes the cue"
                : "Volume preview updated to " + CueVolumeValueText.Text + "; Save writes the cue");
        }

        private void CuePlaybackRateSlider_ValueChanged(object sender, RangeBaseValueChangedEventArgs e)
        {
            if (CuePlaybackRateValueText == null)
            {
                return;
            }

            CuePlaybackRateValueText.Text = FormatPlaybackRate(e.NewValue);
            if (_isApplyingEditorState)
            {
                return;
            }

            var cueSeed = _allCueCards.FirstOrDefault(card => string.Equals(card.Id, _editingCueId, StringComparison.Ordinal));
            if (cueSeed == null)
            {
                return;
            }

            var normalizedPlaybackRate = NormalizeCuePlaybackRate(e.NewValue);
            SetDraftCuePlaybackRate(cueSeed, normalizedPlaybackRate);
            SyncPlaybackParametersDirtyState(cueSeed);

            var appliesToCurrentPlayback = IsEditingCurrentPlayingCue();
            if (appliesToCurrentPlayback)
            {
                ApplyCuePlaybackParametersToActiveSession(cueSeed);
            }

            UpdateStatusHint(appliesToCurrentPlayback
                ? "Playback rate preview updated to " + CuePlaybackRateValueText.Text + "; current playback follows immediately, Save writes the cue"
                : "Playback rate preview updated to " + CuePlaybackRateValueText.Text + "; Save writes the cue");
        }

        private void TrimBoundaryTextBox_TextChanged(object sender, TextChangedEventArgs e)
        {
            UpdateTrimEditingState(false);
            if (_isApplyingEditorState)
            {
                return;
            }

            if (SaveCueButton != null && SaveCueButton.IsEnabled)
            {
                UpdateStatusHint("Trim preview updated; current playback keeps its existing range and the new trim applies on the next trigger after Save");
                return;
            }

            UpdateStatusHint("Trim input is invalid; Save is blocked until the range returns to a legal interval");
        }

        private void TrimBoundaryTextBox_LostFocus(object sender, RoutedEventArgs e)
        {
            if (_isApplyingEditorState)
            {
                return;
            }

            UpdateTrimEditingState(true);
        }

        private void TrimHandle_PointerPressed(object sender, PointerRoutedEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(_editingCueId) || sender is not UIElement element || sender is not FrameworkElement frameworkElement)
            {
                return;
            }

            _activeTrimDragHandle = string.Equals(frameworkElement.Tag as string, "end", StringComparison.OrdinalIgnoreCase)
                ? TrimDragHandle.End
                : TrimDragHandle.Start;

            element.CapturePointer(e.Pointer);
            ApplyTrimDragFromPointerPosition(e.GetCurrentPoint(WaveformTimelineTrackArea).Position.X);
            e.Handled = true;
        }

        private void TrimHandle_PointerMoved(object sender, PointerRoutedEventArgs e)
        {
            if (_activeTrimDragHandle == TrimDragHandle.None || sender is not UIElement element || !element.PointerCaptures.Any())
            {
                return;
            }

            ApplyTrimDragFromPointerPosition(e.GetCurrentPoint(WaveformTimelineTrackArea).Position.X);
            e.Handled = true;
        }

        private void TrimHandle_PointerReleased(object sender, PointerRoutedEventArgs e)
        {
            if (sender is UIElement element)
            {
                element.ReleasePointerCaptures();
            }

            _activeTrimDragHandle = TrimDragHandle.None;
            e.Handled = true;
        }

        private void TrimHandle_PointerCaptureLost(object sender, PointerRoutedEventArgs e)
        {
            _activeTrimDragHandle = TrimDragHandle.None;
        }

        private void WaveformInteractionSurface_SizeChanged(object sender, SizeChangedEventArgs e)
        {
            UpdateWaveformHandleLayout(_lastValidTrimStartSeconds, _lastValidTrimEndSeconds);
        }

        private async void DuplicateCueButton_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(_editingCueId))
            {
                return;
            }

            if (HasUnsavedChanges() && !await ConfirmDiscardChangesAsync())
            {
                UpdateStatusHint("Duplicate cancelled; unsaved changes remain on the current cue");
                return;
            }

            if (HasUnsavedChanges())
            {
                DiscardPendingDrawerChanges(_editingCueId);
            }

            var sourceCue = _allCueCards.FirstOrDefault(card => string.Equals(card.Id, _editingCueId, StringComparison.Ordinal));
            if (sourceCue == null)
            {
                return;
            }

            var duplicateId = BuildNextCueId();
            var duplicateTitle = BuildDuplicateTitle(GetEffectiveTitle(sourceCue));
            var duplicateTags = GetEffectiveTags(sourceCue).ToArray();
            var duplicateColor = GetEffectiveColorKey(sourceCue);
            var duplicateVolume = GetCommittedCueVolumePercent(sourceCue);
            var duplicatePlaybackRate = GetCommittedCuePlaybackRate(sourceCue);
            var duplicateTrim = GetCommittedTrimRange(sourceCue);
            var refreshTagFilterPanel = duplicateTags
                .Any(tag => !_allCueCards
                    .Where(card => card.Kind == CueCardKind.Imported)
                    .SelectMany(card => GetEffectiveTags(card))
                    .Any(existingTag => string.Equals(existingTag, tag, StringComparison.OrdinalIgnoreCase)));

            var duplicateSeed = new CueCardSeed(
                duplicateId,
                CueCardKind.Imported,
                duplicateTitle,
                "--",
                duplicateColor,
                sourceCue.ResourcePath,
                sourceCue.ResourceName,
                sourceCue.TotalDurationSeconds,
                duplicateTags);
            _allCueCards.Add(duplicateSeed);
            _savedColorOverrides[duplicateId] = duplicateColor;
            _savedCueVolumeOverrides[duplicateId] = duplicateVolume;
            _savedCuePlaybackRateOverrides[duplicateId] = duplicatePlaybackRate;
            _savedTrimOverrides[duplicateId] = duplicateTrim;
            _historyEntries.Add("Duplicate:" + duplicateId);

            OpenEditorDrawerShell(duplicateId);
            LoadCueCards(_searchQuery, refreshTagFilterPanel);
            UpdateStatusHint("Duplicate created from committed cue state; the new cue is selected and history recorded");
        }

        private async void DeleteCueButton_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(_editingCueId))
            {
                return;
            }

            var cueToDelete = _allCueCards.FirstOrDefault(card => string.Equals(card.Id, _editingCueId, StringComparison.Ordinal));
            if (cueToDelete == null)
            {
                return;
            }

            if (!await ConfirmDeleteCueAsync(GetEffectiveTitle(cueToDelete)))
            {
                UpdateStatusHint("Delete cancelled");
                return;
            }

            var deletedCueId = cueToDelete.Id;
            var deletedCueTitle = GetEffectiveTitle(cueToDelete);
            var wasPlaying = string.Equals(_activePlayingCueId, deletedCueId, StringComparison.Ordinal);
            var deletedCueTags = GetEffectiveTags(cueToDelete).ToArray();
            var refreshTagFilterPanel = deletedCueTags.Any(tag =>
                !_allCueCards
                    .Where(card => card.Kind == CueCardKind.Imported && !string.Equals(card.Id, deletedCueId, StringComparison.Ordinal))
                    .SelectMany(card => GetEffectiveTags(card))
                    .Any(existingTag => string.Equals(existingTag, tag, StringComparison.OrdinalIgnoreCase)));

            _allCueCards.Remove(cueToDelete);
            RemoveCueOverrides(deletedCueId);
            _historyEntries.Add("Delete:" + deletedCueId);

            if (wasPlaying)
            {
                if (cueToDelete.HasPlayableAudio)
                {
                    _playbackService.StopAll();
                }

                _isPlaying = false;
                _activePlayingCueId = string.Empty;
                ResetActiveCuePlaybackSession();
                RefreshBottomPlaybackControls();
            }

            ResetDrawerSaveStateFlags();
            CloseEditorDrawerShell();
            LoadCueCards(_searchQuery, refreshTagFilterPanel);
            UpdateStatusHint(wasPlaying
                ? "Deleted " + deletedCueTitle + "; playback stopped, drawer closed, and history recorded"
                : "Deleted " + deletedCueTitle + "; drawer closed and history recorded");
        }

        private void GlobalHotkeyToggle_Toggled(object sender, RoutedEventArgs e)
        {
            if (_isApplyingBottomControlState || GlobalHotkeyToggle == null)
            {
                return;
            }

            _globalHotkeysEnabled = GlobalHotkeyToggle.IsOn;
            RebuildGlobalHotkeyRegistrations();
            UpdateStatusHint(_globalHotkeysEnabled
                ? "Global hotkeys enabled"
                : "Global hotkeys disabled");
        }

        private async void PlayPauseButton_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(_activePlayingCueId))
            {
                _isPlaying = false;
                ResetActiveCuePlaybackSession();
                RefreshBottomPlaybackControls();
                UpdateStatusHint("Select a cue card first; play/pause only controls the current playback target");
                return;
            }

            var activeCue = _allCueCards.FirstOrDefault(card => string.Equals(card.Id, _activePlayingCueId, StringComparison.Ordinal));
            if (activeCue == null)
            {
                _isPlaying = false;
                ResetActiveCuePlaybackSession();
                RefreshBottomPlaybackControls();
                RefreshVisibleCueCardsState();
                UpdateStatusHint("Current playback target no longer exists");
                return;
            }

            if (activeCue.HasPlayableAudio)
            {
                var playbackState = _playbackService.GetCurrentState();
                if (!string.IsNullOrWhiteSpace(playbackState.ActiveCueId))
                {
                    _playbackService.TogglePauseResume();
                }
                else
                {
                    try
                    {
                        await _playbackService.PlayCueAsync(BuildPlaybackCueRecord(activeCue));
                    }
                    catch (Exception exception)
                    {
                        _isPlaying = false;
                        ResetActiveCuePlaybackSession();
                        RefreshBottomPlaybackControls();
                        RefreshVisibleCueCardsState();
                        UpdateStatusHint("Real audio playback failed: " + exception.Message);
                        return;
                    }
                }

                return;
            }

            _isPlaying = !_isPlaying;
            RefreshBottomPlaybackControls();
            RefreshVisibleCueCardsState();
            UpdateStatusHint(_isPlaying ? "Playback state: running" : "Playback state: paused");
        }

        private void VolumeSlider_ValueChanged(object sender, RangeBaseValueChangedEventArgs e)
        {
            if (_isApplyingBottomControlState)
            {
                return;
            }

            _masterVolumePercent = e.NewValue;
            _playbackService.SetGlobalVolume(_masterVolumePercent / 100d);
            RefreshBottomPlaybackControls();
            UpdateStatusHint("Master volume: " + Math.Round(_masterVolumePercent).ToString("0") + "%");
        }

        private void RepeatPlaybackToggle_Toggled(object sender, RoutedEventArgs e)
        {
            if (_isApplyingBottomControlState || RepeatPlaybackToggle == null)
            {
                return;
            }

            _repeatPlaybackEnabled = RepeatPlaybackToggle.IsOn;
            _playbackService.SetRepeatPlayback(_repeatPlaybackEnabled);
            UpdateStatusHint(_repeatPlaybackEnabled
                ? "Repeat playback enabled"
                : "Repeat playback disabled");
        }

        private void UpdateStatusHint(string? message)
        {
            if (StatusHintText == null)
            {
                return;
            }

            StatusHintText.Text = message ?? BuildDefaultStatusHint();
        }

        private async Task<bool> TryPlayCueAsync(CueCardSeed cueSeed, string statusPrefix)
        {
            _activePlayingCueId = cueSeed.Id;
            ApplyCuePlaybackParametersToActiveSession(cueSeed);
            ApplyCueTrimRangeToActiveSession(cueSeed);

            if (cueSeed.HasPlayableAudio)
            {
                try
                {
                    await _playbackService.PlayCueAsync(BuildPlaybackCueRecord(cueSeed));
                }
                catch (Exception exception)
                {
                    _isPlaying = false;
                    ResetActiveCuePlaybackSession();
                    RefreshBottomPlaybackControls();
                    RefreshVisibleCueCardsState();
                    UpdateStatusHint("Real audio playback failed: " + exception.Message);
                    return false;
                }
            }
            else
            {
                _isPlaying = true;
                RefreshBottomPlaybackControls();
                RefreshVisibleCueCardsState();
            }

            UpdateStatusHint(cueSeed.HasPlayableAudio
                ? statusPrefix + "the real audio clip for " + GetEffectiveTitle(cueSeed)
                : statusPrefix + GetEffectiveTitle(cueSeed));
            return true;
        }

        private void PlaybackService_PlaybackStateChanged(object? sender, PlaybackStateSnapshot state)
        {
            if (DispatcherQueue == null)
            {
                return;
            }

            DispatcherQueue.TryEnqueue(() =>
            {
                _isPlaying = state.IsPlaying;

                if (!string.IsNullOrWhiteSpace(state.ActiveCueId))
                {
                    _activePlayingCueId = state.ActiveCueId;
                }
                else if (!state.IsPaused)
                {
                    _activePlayingCueId = string.Empty;
                    ResetActiveCuePlaybackSession();
                }

                RefreshBottomPlaybackControls();
                RefreshVisibleCueCardsState();
                UpdateStatusHint(null);
            });
        }

        private void ImportAudioFilePaths(IEnumerable<string> filePaths, string successPrefix, string failureMessage)
        {
            var addedCueCount = 0;
            foreach (var filePath in filePaths.Distinct(StringComparer.OrdinalIgnoreCase))
            {
                if (!TryCreateImportedCueSeed(filePath, out var importedCue))
                {
                    continue;
                }

                _allCueCards.Add(importedCue);
                addedCueCount++;
            }

            if (addedCueCount == 0)
            {
                UpdateStatusHint(failureMessage);
                return;
            }

            LoadCueCards(_searchQuery, refreshTagFilterPanel: true);
            UpdateStatusHint(successPrefix + addedCueCount.ToString(CultureInfo.InvariantCulture) + " audio file(s); click a card to play the real clip");
        }

        private void RefreshVisibleCueCardsState()
        {
            foreach (var visibleCue in _visibleCueCards)
            {
                var seed = _allCueCards.FirstOrDefault(card => string.Equals(card.Id, visibleCue.Id, StringComparison.Ordinal));
                if (seed == null)
                {
                    continue;
                }

                var updatedCard = seed.Kind == CueCardKind.Imported
                    ? BuildImportedCard(seed)
                    : BuildPlaceholderCard(seed);
                visibleCue.ApplyFrom(updatedCard);
            }
        }

        private int ScaleLogicalWidth(int logicalWidth)
        {
            return MulDiv(logicalWidth, unchecked((int)GetDpiForWindow(_windowHandle)), 96);
        }

        private int ScaleLogicalHeight(int logicalHeight)
        {
            return MulDiv(logicalHeight, unchecked((int)GetDpiForWindow(_windowHandle)), 96);
        }

        private nint HandleWindowMessage(nint hwnd, uint message, nuint wParam, nint lParam, nuint subclassId, nuint refData)
        {
            if (message == WmDropFiles)
            {
                HandleNativeFileDrop(wParam);
                return nint.Zero;
            }

            if (message == WmHotKey)
            {
                HandleRegisteredHotkey((int)wParam);
                return nint.Zero;
            }

            if (message == WmGetMinMaxInfo)
            {
                var minMaxInfo = Marshal.PtrToStructure<MINMAXINFO>(lParam);
                minMaxInfo.ptMinTrackSize.x = ScaleLogicalWidth(_layoutProfile.MinWindowWidthLogical);
                minMaxInfo.ptMinTrackSize.y = ScaleLogicalHeight(_layoutProfile.MinWindowHeightLogical);
                Marshal.StructureToPtr(minMaxInfo, lParam, false);
                return nint.Zero;
            }

            return DefSubclassProc(hwnd, message, wParam, lParam);
        }

        private void MainWindow_Closed(object sender, WindowEventArgs args)
        {
            if (_windowHandle != nint.Zero && _windowSubclassProc != null)
            {
                RemoveWindowSubclass(_windowHandle, _windowSubclassProc, 1);
            }

            UnregisterAllGlobalHotkeys();
            _playbackService.Dispose();
        }

        private void HandleNativeFileDrop(nuint dropHandleValue)
        {
            var dropHandle = new nint(unchecked((long)dropHandleValue));
            try
            {
                var fileCount = DragQueryFile(dropHandle, 0xFFFFFFFF, null, 0);
                if (fileCount == 0)
                {
                    UpdateStatusHint("Dropped audio files could not be imported");
                    return;
                }

                var filePaths = new List<string>();
                for (uint index = 0; index < fileCount; index++)
                {
                    var characterCount = DragQueryFile(dropHandle, index, null, 0);
                    if (characterCount == 0)
                    {
                        continue;
                    }

                    var buffer = new System.Text.StringBuilder((int)characterCount + 1);
                    DragQueryFile(dropHandle, index, buffer, (uint)buffer.Capacity);
                    filePaths.Add(buffer.ToString());
                }

                ImportAudioFilePaths(filePaths, "Imported ", "Dropped audio files could not be imported");
            }
            finally
            {
                DragFinish(dropHandle);
            }
        }

        private void ApplyEditorState(string cueId)
        {
            var cueSeed = _allCueCards.FirstOrDefault(card => string.Equals(card.Id, cueId, StringComparison.Ordinal));
            if (cueSeed == null)
            {
                return;
            }

            _isApplyingEditorState = true;
            CueNameTextBox.Text = GetEffectiveTitle(cueSeed);
            CueTagsTextBox.Text = string.Join(", ", GetEffectiveTags(cueSeed));
            CueHotkeyTextBox.Text = GetEffectiveHotkeyDisplay(cueSeed);
            var effectiveVolume = GetEffectiveCueVolumePercent(cueSeed);
            var effectivePlaybackRate = GetEffectiveCuePlaybackRate(cueSeed);
            var effectiveTrimRange = GetEffectiveTrimRange(cueSeed);
            CueVolumeSlider.Value = effectiveVolume;
            CuePlaybackRateSlider.Value = effectivePlaybackRate;
            CueVolumeValueText.Text = Math.Round(effectiveVolume).ToString("0", CultureInfo.InvariantCulture) + "%";
            CuePlaybackRateValueText.Text = FormatPlaybackRate(effectivePlaybackRate);
            TrimStartTextBox.Text = FormatSeconds(effectiveTrimRange.StartSeconds);
            TrimEndTextBox.Text = FormatSeconds(effectiveTrimRange.EndSeconds);
            _lastValidTrimStartSeconds = effectiveTrimRange.StartSeconds;
            _lastValidTrimEndSeconds = effectiveTrimRange.EndSeconds;
            TrimSectionContent.Visibility = Visibility.Collapsed;
            TrimSectionToggleButton.Content = "Expand";
            TrimSectionHintText.Text = "Collapsed by default. Expand only when trim editing is needed.";
            _isBasicInfoValid = true;
            _isHotkeyValid = true;
            ResetDrawerSaveStateFlags();
            ExitHotkeyRecording();
            HotkeyValidationText.Visibility = Visibility.Collapsed;
            UpdateBasicInfoEditorState();
            UpdateHotkeyEditorState();
            UpdateTrimEditingState(true);
            _isApplyingEditorState = false;
        }

        private void UpdateBasicInfoEditingState()
        {
            if (CueNameTextBox == null || CueTagsTextBox == null || CueNameValidationText == null)
            {
                return;
            }

            var cueSeed = _allCueCards.FirstOrDefault(card => string.Equals(card.Id, _editingCueId, StringComparison.Ordinal));
            if (cueSeed == null)
            {
                return;
            }

            var trimmedName = (CueNameTextBox.Text ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(trimmedName))
            {
                _isBasicInfoValid = false;
                CueNameValidationText.Text = "Cue name is required.";
                CueNameValidationText.Visibility = Visibility.Visible;
            }
            else
            {
                _isBasicInfoValid = true;
                CueNameValidationText.Visibility = Visibility.Collapsed;
                SetDraftTitle(cueSeed, trimmedName.Length > MaxCueNameLength ? trimmedName[..MaxCueNameLength] : trimmedName);
            }

            SetDraftTags(cueSeed, ParseTags(CueTagsTextBox.Text));
            UpdateBasicInfoEditorState();
            SyncBasicInfoDirtyState(cueSeed);
        }

        private void UpdateBasicInfoEditorState()
        {
            if (string.IsNullOrWhiteSpace(_editingCueId))
            {
                return;
            }

            var cueSeed = _allCueCards.FirstOrDefault(card => string.Equals(card.Id, _editingCueId, StringComparison.Ordinal));
            if (cueSeed == null)
            {
                return;
            }

            UpdateTagChipPreview(GetEffectiveTags(cueSeed));
            UpdateColorPaletteState(GetEffectiveColorKey(cueSeed));
            UpdateResourceInfo(cueSeed);
            UpdateSaveAvailability();
        }

        private void UpdateTagChipPreview(IReadOnlyList<string> tags)
        {
            if (SelectedTagChipPanel == null)
            {
                return;
            }

            SelectedTagChipPanel.Children.Clear();
            if (tags.Count == 0)
            {
                SelectedTagChipPanel.Children.Add(new TextBlock
                {
                    Foreground = new SolidColorBrush(Windows.UI.Color.FromArgb(255, 148, 163, 184)),
                    Text = "No tags",
                });
                return;
            }

            foreach (var tag in tags)
            {
                var border = new Border
                {
                    Background = new SolidColorBrush(Windows.UI.Color.FromArgb(255, 30, 41, 59)),
                    BorderBrush = new SolidColorBrush(Windows.UI.Color.FromArgb(255, 71, 85, 105)),
                    BorderThickness = new Thickness(1),
                    CornerRadius = new CornerRadius(999),
                    Padding = new Thickness(10, 4, 10, 4),
                    Child = new TextBlock
                    {
                        Foreground = new SolidColorBrush(Windows.UI.Color.FromArgb(255, 226, 232, 240)),
                        Text = tag,
                    },
                };
                SelectedTagChipPanel.Children.Add(border);
            }
        }

        private void UpdateColorPaletteState(string selectedColorKey)
        {
            if (ColorSelectionText == null)
            {
                return;
            }

            foreach (var button in EnumerateColorButtons())
            {
                var isSelected = string.Equals(button.Tag as string, selectedColorKey, StringComparison.OrdinalIgnoreCase);
                button.BorderThickness = new Thickness(isSelected ? 3 : 1);
                button.BorderBrush = new SolidColorBrush(isSelected
                    ? Colors.White
                    : Windows.UI.Color.FromArgb(255, 203, 213, 225));
            }

            ColorSelectionText.Text = "Selected color: " + GetColorDisplayName(selectedColorKey);
        }

        private IEnumerable<Button> EnumerateColorButtons()
        {
            return new[]
            {
                ColorButtonSlate,
                ColorButtonRed,
                ColorButtonOrange,
                ColorButtonAmber,
                ColorButtonLime,
                ColorButtonEmerald,
                ColorButtonSky,
                ColorButtonIndigo,
                ColorButtonRose,
            }.Where(button => button != null)!;
        }

        private void UpdateResourceInfo(CueCardSeed seed)
        {
            if (ResourceFileNameText == null || ResourceSourceText == null || ResourceDurationText == null)
            {
                return;
            }

            ResourceFileNameText.Text = BuildResourceFileName(seed);
            ResourceSourceText.Text = seed.HasPlayableAudio ? "Dropped audio file" : "Shell demo cue";
            ResourceDurationText.Text = FormatSeconds(seed.TotalDurationSeconds);
        }

        private TrimRange GetEffectiveTrimRange(CueCardSeed seed)
        {
            if (_draftTrimOverrides.TryGetValue(seed.Id, out var draftTrim))
            {
                return draftTrim;
            }

            if (_savedTrimOverrides.TryGetValue(seed.Id, out var savedTrim))
            {
                return savedTrim;
            }

            return new TrimRange(DefaultTrimStartSeconds, seed.TotalDurationSeconds);
        }

        private TrimRange GetCommittedTrimRange(CueCardSeed seed)
        {
            if (_savedTrimOverrides.TryGetValue(seed.Id, out var savedTrim))
            {
                return savedTrim;
            }

            return new TrimRange(DefaultTrimStartSeconds, seed.TotalDurationSeconds);
        }

        private void SetDraftTrimRange(CueCardSeed seed, double startSeconds, double endSeconds)
        {
            if (string.IsNullOrWhiteSpace(seed.Id))
            {
                return;
            }

            var normalizedTrim = new TrimRange(SnapSeconds(startSeconds), SnapSeconds(endSeconds));
            if (AreTrimRangesEqual(normalizedTrim, GetCommittedTrimRange(seed)))
            {
                _draftTrimOverrides.Remove(seed.Id);
                return;
            }

            _draftTrimOverrides[seed.Id] = normalizedTrim;
        }

        private void SyncTrimDirtyState(CueCardSeed seed)
        {
            var committedTrim = GetCommittedTrimRange(seed);
            if (_isTrimValid
                && TryParseSeconds(TrimStartTextBox?.Text, out var rawStartSeconds)
                && TryParseSeconds(TrimEndTextBox?.Text, out var rawEndSeconds))
            {
                var currentTrim = new TrimRange(SnapSeconds(rawStartSeconds), SnapSeconds(rawEndSeconds));
                _isTrimDirty = !AreTrimRangesEqual(currentTrim, committedTrim);
            }
            else
            {
                var startText = (TrimStartTextBox?.Text ?? string.Empty).Trim();
                var endText = (TrimEndTextBox?.Text ?? string.Empty).Trim();
                _isTrimDirty = !string.Equals(startText, FormatSeconds(committedTrim.StartSeconds), StringComparison.Ordinal)
                    || !string.Equals(endText, FormatSeconds(committedTrim.EndSeconds), StringComparison.Ordinal);
            }

            if (_isTrimDirty)
            {
                _showSavedHeaderState = false;
            }

            UpdateSaveAvailability();
        }

        private void CommitTrimDraft(string cueId)
        {
            if (string.IsNullOrWhiteSpace(cueId))
            {
                return;
            }

            if (_draftTrimOverrides.TryGetValue(cueId, out var draftTrim))
            {
                _savedTrimOverrides[cueId] = draftTrim;
                _draftTrimOverrides.Remove(cueId);
            }

            _isTrimDirty = false;
            UpdateSaveAvailability();
        }

        private void DiscardTrimDraft(string cueId)
        {
            if (string.IsNullOrWhiteSpace(cueId))
            {
                return;
            }

            if (_draftTrimOverrides.Remove(cueId))
            {
                if (string.Equals(_activePlayingCueId, cueId, StringComparison.Ordinal))
                {
                    var cueSeed = _allCueCards.FirstOrDefault(card => string.Equals(card.Id, cueId, StringComparison.Ordinal));
                    if (cueSeed != null)
                    {
                        var committedTrim = GetCommittedTrimRange(cueSeed);
                        _activeCueSessionTrimStartSeconds = committedTrim.StartSeconds;
                        _activeCueSessionTrimEndSeconds = committedTrim.EndSeconds;
                    }
                }

                _isTrimDirty = false;
                UpdateSaveAvailability();
            }
        }

        private void ApplyCueTrimRangeToActiveSession(CueCardSeed seed)
        {
            var effectiveTrim = GetEffectiveTrimRange(seed);
            _activeCueSessionTrimStartSeconds = effectiveTrim.StartSeconds;
            _activeCueSessionTrimEndSeconds = effectiveTrim.EndSeconds;
        }

        private void UpdateWaveformHandleLayout(double startSeconds, double endSeconds)
        {
            if (WaveformTimelineTrackArea == null
                || WaveformSelectionBand == null
                || WaveformStartHandleHitArea == null
                || WaveformEndHandleHitArea == null)
            {
                return;
            }

            var trackWidth = WaveformTimelineTrackArea.ActualWidth;
            if (trackWidth <= 0)
            {
                return;
            }

            var totalDurationSeconds = GetEditingCueTotalDurationSeconds();
            var normalizedStart = Math.Clamp(startSeconds / totalDurationSeconds, 0, 1);
            var normalizedEnd = Math.Clamp(endSeconds / totalDurationSeconds, 0, 1);
            var startX = trackWidth * normalizedStart;
            var endX = trackWidth * normalizedEnd;
            var highlightWidth = Math.Max(0, endX - startX);
            var maxHandleLeft = Math.Max(0, trackWidth - 24);
            var startHandleLeft = Math.Clamp(startX - 12, 0, maxHandleLeft);
            var endHandleLeft = Math.Clamp(endX - 12, 0, maxHandleLeft);

            WaveformSelectionBand.Margin = new Thickness(12 + startX, 8, 0, 8);
            WaveformSelectionBand.Width = highlightWidth;
            WaveformStartHandleHitArea.Margin = new Thickness(12 + startHandleLeft, 0, 0, 0);
            WaveformEndHandleHitArea.Margin = new Thickness(12 + endHandleLeft, 0, 0, 0);
        }

        private void ApplyTrimDragFromPointerPosition(double pointerX)
        {
            if (WaveformTimelineTrackArea == null || string.IsNullOrWhiteSpace(_editingCueId))
            {
                return;
            }

            var cueSeed = _allCueCards.FirstOrDefault(card => string.Equals(card.Id, _editingCueId, StringComparison.Ordinal));
            if (cueSeed == null)
            {
                return;
            }

            var trackWidth = WaveformTimelineTrackArea.ActualWidth;
            if (trackWidth <= 0)
            {
                return;
            }

            var clampedPointerX = Math.Clamp(pointerX, 0, trackWidth);
            var totalDurationSeconds = GetEditingCueTotalDurationSeconds();
            var snappedSeconds = SnapSeconds(clampedPointerX / trackWidth * totalDurationSeconds);
            var startSeconds = _lastValidTrimStartSeconds;
            var endSeconds = _lastValidTrimEndSeconds;

            if (_activeTrimDragHandle == TrimDragHandle.Start)
            {
                startSeconds = Math.Clamp(snappedSeconds, DefaultTrimStartSeconds, endSeconds - MinimumTrimDurationSeconds);
            }
            else if (_activeTrimDragHandle == TrimDragHandle.End)
            {
                endSeconds = Math.Clamp(snappedSeconds, startSeconds + MinimumTrimDurationSeconds, totalDurationSeconds);
            }
            else
            {
                return;
            }

            _isApplyingEditorState = true;
            TrimStartTextBox.Text = FormatSeconds(startSeconds);
            TrimEndTextBox.Text = FormatSeconds(endSeconds);
            _isApplyingEditorState = false;

            UpdateTrimEditingState(true);
            UpdateStatusHint("Trim preview updated; current playback keeps its existing range and the new trim applies on the next trigger after Save");
        }

        private double GetEffectiveCueVolumePercent(CueCardSeed seed)
        {
            if (_draftCueVolumeOverrides.TryGetValue(seed.Id, out var draftVolume))
            {
                return draftVolume;
            }

            if (_savedCueVolumeOverrides.TryGetValue(seed.Id, out var savedVolume))
            {
                return savedVolume;
            }

            return DefaultCueVolumePercent;
        }

        private double GetCommittedCueVolumePercent(CueCardSeed seed)
        {
            if (_savedCueVolumeOverrides.TryGetValue(seed.Id, out var savedVolume))
            {
                return savedVolume;
            }

            return DefaultCueVolumePercent;
        }

        private double GetEffectiveCuePlaybackRate(CueCardSeed seed)
        {
            if (_draftCuePlaybackRateOverrides.TryGetValue(seed.Id, out var draftPlaybackRate))
            {
                return draftPlaybackRate;
            }

            if (_savedCuePlaybackRateOverrides.TryGetValue(seed.Id, out var savedPlaybackRate))
            {
                return savedPlaybackRate;
            }

            return DefaultCuePlaybackRate;
        }

        private double GetCommittedCuePlaybackRate(CueCardSeed seed)
        {
            if (_savedCuePlaybackRateOverrides.TryGetValue(seed.Id, out var savedPlaybackRate))
            {
                return savedPlaybackRate;
            }

            return DefaultCuePlaybackRate;
        }

        private void SetDraftCueVolume(CueCardSeed seed, double volumePercent)
        {
            if (string.IsNullOrWhiteSpace(seed.Id))
            {
                return;
            }

            var normalizedVolume = NormalizeCueVolumePercent(volumePercent);
            if (ArePlaybackValuesEqual(normalizedVolume, GetCommittedCueVolumePercent(seed)))
            {
                _draftCueVolumeOverrides.Remove(seed.Id);
                return;
            }

            _draftCueVolumeOverrides[seed.Id] = normalizedVolume;
        }

        private void SetDraftCuePlaybackRate(CueCardSeed seed, double playbackRate)
        {
            if (string.IsNullOrWhiteSpace(seed.Id))
            {
                return;
            }

            var normalizedPlaybackRate = NormalizeCuePlaybackRate(playbackRate);
            if (ArePlaybackValuesEqual(normalizedPlaybackRate, GetCommittedCuePlaybackRate(seed)))
            {
                _draftCuePlaybackRateOverrides.Remove(seed.Id);
                return;
            }

            _draftCuePlaybackRateOverrides[seed.Id] = normalizedPlaybackRate;
        }

        private void SyncPlaybackParametersDirtyState(CueCardSeed seed)
        {
            var currentVolume = NormalizeCueVolumePercent(CueVolumeSlider?.Value ?? GetEffectiveCueVolumePercent(seed));
            var currentPlaybackRate = NormalizeCuePlaybackRate(CuePlaybackRateSlider?.Value ?? GetEffectiveCuePlaybackRate(seed));

            var hasVolumeChange = !ArePlaybackValuesEqual(currentVolume, GetCommittedCueVolumePercent(seed));
            var hasPlaybackRateChange = !ArePlaybackValuesEqual(currentPlaybackRate, GetCommittedCuePlaybackRate(seed));

            _isPlaybackParamsDirty = hasVolumeChange || hasPlaybackRateChange;
            if (_isPlaybackParamsDirty)
            {
                _showSavedHeaderState = false;
            }

            UpdateSaveAvailability();
        }

        private void CommitPlaybackParametersDraft(string cueId)
        {
            if (string.IsNullOrWhiteSpace(cueId))
            {
                return;
            }

            if (_draftCueVolumeOverrides.TryGetValue(cueId, out var draftVolume))
            {
                _savedCueVolumeOverrides[cueId] = draftVolume;
                _draftCueVolumeOverrides.Remove(cueId);
            }

            if (_draftCuePlaybackRateOverrides.TryGetValue(cueId, out var draftPlaybackRate))
            {
                _savedCuePlaybackRateOverrides[cueId] = draftPlaybackRate;
                _draftCuePlaybackRateOverrides.Remove(cueId);
            }

            _isPlaybackParamsDirty = false;
            UpdateSaveAvailability();
        }

        private void DiscardPlaybackParametersDraft(string cueId)
        {
            if (string.IsNullOrWhiteSpace(cueId))
            {
                return;
            }

            var removedVolumeDraft = _draftCueVolumeOverrides.Remove(cueId);
            var removedPlaybackRateDraft = _draftCuePlaybackRateOverrides.Remove(cueId);
            if (!removedVolumeDraft && !removedPlaybackRateDraft)
            {
                return;
            }

            if (string.Equals(_activePlayingCueId, cueId, StringComparison.Ordinal))
            {
                var cueSeed = _allCueCards.FirstOrDefault(card => string.Equals(card.Id, cueId, StringComparison.Ordinal));
                if (cueSeed != null)
                {
                    _activeCueSessionVolumePercent = GetCommittedCueVolumePercent(cueSeed);
                    _activeCueSessionPlaybackRate = GetCommittedCuePlaybackRate(cueSeed);
                }
                else
                {
                    ResetActiveCuePlaybackSession();
                }
            }

            _isPlaybackParamsDirty = false;
            UpdateSaveAvailability();
        }

        private void ApplyCuePlaybackParametersToActiveSession(CueCardSeed seed)
        {
            _activeCueSessionVolumePercent = GetEffectiveCueVolumePercent(seed);
            _activeCueSessionPlaybackRate = GetEffectiveCuePlaybackRate(seed);
        }

        private void ResetActiveCuePlaybackSession()
        {
            _activeCueSessionVolumePercent = DefaultCueVolumePercent;
            _activeCueSessionPlaybackRate = DefaultCuePlaybackRate;
            _activeCueSessionTrimStartSeconds = DefaultTrimStartSeconds;
            _activeCueSessionTrimEndSeconds = DefaultTrimEndSeconds;
        }

        private void UpdateTrimEditingState(bool normalizeText)
        {
            if (TrimSummaryText == null
                || TrimStartTextBox == null
                || TrimEndTextBox == null
                || TrimValidationText == null
                || SaveCueButton == null
                || WaveformStartTimeText == null
                || WaveformRangeText == null
                || WaveformTotalDurationText == null
                || WaveformHighlightText == null
                || WaveformHandleRuleText == null)
            {
                return;
            }

            var cueSeed = _allCueCards.FirstOrDefault(card => string.Equals(card.Id, _editingCueId, StringComparison.Ordinal));

            var totalDurationSeconds = cueSeed?.TotalDurationSeconds ?? DefaultCueTotalDurationSeconds;
            WaveformTotalDurationText.Text = "Total " + FormatSeconds(totalDurationSeconds);

            var hasStart = TryParseSeconds(TrimStartTextBox.Text, out var rawStartSeconds);
            var hasEnd = TryParseSeconds(TrimEndTextBox.Text, out var rawEndSeconds);
            if (!hasStart || !hasEnd)
            {
                ShowInvalidTrimState("Numeric seconds are required for both trim boundaries.");
                if (cueSeed != null)
                {
                    SyncTrimDirtyState(cueSeed);
                }
                return;
            }

            var startSeconds = SnapSeconds(rawStartSeconds);
            var endSeconds = SnapSeconds(rawEndSeconds);
            if (startSeconds < 0)
            {
                ShowInvalidTrimState("Trim start may not be below 0.00 s.");
                if (cueSeed != null)
                {
                    SyncTrimDirtyState(cueSeed);
                }
                return;
            }

            if (endSeconds > totalDurationSeconds)
            {
                ShowInvalidTrimState("Trim end may not exceed total clip duration.");
                if (cueSeed != null)
                {
                    SyncTrimDirtyState(cueSeed);
                }
                return;
            }

            if (startSeconds >= endSeconds)
            {
                ShowInvalidTrimState("Trim start must stay before trim end.");
                if (cueSeed != null)
                {
                    SyncTrimDirtyState(cueSeed);
                }
                return;
            }

            if (endSeconds - startSeconds < MinimumTrimDurationSeconds)
            {
                ShowInvalidTrimState("Trim range must be at least " + FormatSeconds(MinimumTrimDurationSeconds) + ".");
                if (cueSeed != null)
                {
                    SyncTrimDirtyState(cueSeed);
                }
                return;
            }

            _lastValidTrimStartSeconds = startSeconds;
            _lastValidTrimEndSeconds = endSeconds;
            _isTrimValid = true;
            TrimValidationText.Visibility = Visibility.Collapsed;

            if (normalizeText)
            {
                _isApplyingEditorState = true;
                TrimStartTextBox.Text = FormatSeconds(startSeconds);
                TrimEndTextBox.Text = FormatSeconds(endSeconds);
                _isApplyingEditorState = false;
            }

            var isFullClip = Math.Abs(startSeconds - DefaultTrimStartSeconds) < 0.001
                && Math.Abs(endSeconds - totalDurationSeconds) < 0.001;
            TrimSummaryText.Text = (isFullClip ? "Full clip" : "Trimmed")
                + " | "
                + FormatSeconds(startSeconds)
                + " -> "
                + FormatSeconds(endSeconds);
            WaveformStartTimeText.Text = FormatSeconds(startSeconds);
            WaveformRangeText.Text = "Trimmed range | " + FormatSeconds(startSeconds) + " -> " + FormatSeconds(endSeconds);
            WaveformHighlightText.Text = "Highlighted trim | " + FormatSeconds(startSeconds) + " -> " + FormatSeconds(endSeconds);
            WaveformHandleRuleText.Text = "Snap 0.01 s | Min range 0.05 s | Active playback keeps old trim until next trigger.";
            UpdateWaveformHandleLayout(startSeconds, endSeconds);

            if (!_isApplyingEditorState && cueSeed != null)
            {
                SetDraftTrimRange(cueSeed, startSeconds, endSeconds);
                SyncTrimDirtyState(cueSeed);
                return;
            }

            UpdateSaveAvailability();
        }

        private void ShowInvalidTrimState(string message)
        {
            if (TrimSummaryText == null
                || TrimValidationText == null
                || SaveCueButton == null
                || WaveformStartTimeText == null
                || WaveformRangeText == null
                || WaveformHighlightText == null
                || WaveformHandleRuleText == null)
            {
                return;
            }

            _isTrimValid = false;
            TrimValidationText.Text = message;
            TrimValidationText.Visibility = Visibility.Visible;
            TrimSummaryText.Text = "Invalid trim | Last valid " + FormatSeconds(_lastValidTrimStartSeconds) + " -> " + FormatSeconds(_lastValidTrimEndSeconds);
            WaveformStartTimeText.Text = FormatSeconds(_lastValidTrimStartSeconds);
            WaveformRangeText.Text = "Trimmed range | " + FormatSeconds(_lastValidTrimStartSeconds) + " -> " + FormatSeconds(_lastValidTrimEndSeconds);
            WaveformHighlightText.Text = "Last valid trim | " + FormatSeconds(_lastValidTrimStartSeconds) + " -> " + FormatSeconds(_lastValidTrimEndSeconds);
            WaveformHandleRuleText.Text = "Invalid manual input does not move the waveform; drag remains clamped to the nearest legal range.";
            UpdateWaveformHandleLayout(_lastValidTrimStartSeconds, _lastValidTrimEndSeconds);
            UpdateSaveAvailability();
        }

        private static double SnapSeconds(double value)
        {
            return Math.Round(value / TrimSnapStepSeconds, MidpointRounding.AwayFromZero) * TrimSnapStepSeconds;
        }

        private double GetEditingCueTotalDurationSeconds()
        {
            var cueSeed = _allCueCards.FirstOrDefault(card => string.Equals(card.Id, _editingCueId, StringComparison.Ordinal));
            return cueSeed?.TotalDurationSeconds ?? DefaultCueTotalDurationSeconds;
        }

        private bool IsEditingCurrentPlayingCue()
        {
            return _isPlaying
                && !string.IsNullOrWhiteSpace(_editingCueId)
                && string.Equals(_editingCueId, _activePlayingCueId, StringComparison.Ordinal);
        }

        private static string FormatPlaybackRate(double value)
        {
            var text = value.ToString("0.00", CultureInfo.InvariantCulture).TrimEnd('0');
            if (text.EndsWith(".", StringComparison.Ordinal))
            {
                text += "0";
            }

            return text + "x";
        }

        private static double NormalizeCueVolumePercent(double value)
        {
            return Math.Clamp(Math.Round(value, MidpointRounding.AwayFromZero), 0, 100);
        }

        private static double NormalizeCuePlaybackRate(double value)
        {
            return Math.Clamp(
                Math.Round(value / CuePlaybackRateStep, MidpointRounding.AwayFromZero) * CuePlaybackRateStep,
                0.5,
                1.5);
        }

        private static bool ArePlaybackValuesEqual(double left, double right)
        {
            return Math.Abs(left - right) < 0.001;
        }

        private static bool AreTrimRangesEqual(TrimRange left, TrimRange right)
        {
            return Math.Abs(left.StartSeconds - right.StartSeconds) < 0.001
                && Math.Abs(left.EndSeconds - right.EndSeconds) < 0.001;
        }

        private static string FormatSeconds(double value)
        {
            return value.ToString("0.00", CultureInfo.InvariantCulture) + " s";
        }

        private static bool TryParseSeconds(string? text, out double value)
        {
            var normalized = (text ?? string.Empty).Replace("s", string.Empty, StringComparison.OrdinalIgnoreCase).Trim();
            return double.TryParse(normalized, NumberStyles.Float, CultureInfo.InvariantCulture, out value);
        }

        private void UpdateSaveAvailability()
        {
            if (SaveCueButton == null)
            {
                return;
            }

            SaveCueButton.IsEnabled = HasUnsavedChanges() && _isBasicInfoValid && _isTrimValid && _isHotkeyValid;
            UpdateDrawerHeaderState();
        }

        private bool HasUnsavedChanges()
        {
            return _isBasicInfoDirty || _isHotkeyDirty || _isTrimDirty || _isPlaybackParamsDirty;
        }

        private void DiscardPendingDrawerChanges(string cueId)
        {
            if (string.IsNullOrWhiteSpace(cueId))
            {
                return;
            }

            ResetDrawerSaveStateFlags();
            DiscardBasicInfoDraft(cueId);
            DiscardHotkeyDraft(cueId);
            DiscardPlaybackParametersDraft(cueId);
            DiscardTrimDraft(cueId);
            ExitHotkeyRecording();
        }

        private void MarkBasicInfoDirty()
        {
            _isBasicInfoDirty = true;
            _showSavedHeaderState = false;
            UpdateSaveAvailability();
        }

        private void MarkHotkeyDirty()
        {
            _isHotkeyDirty = true;
            _showSavedHeaderState = false;
            UpdateSaveAvailability();
        }

        private void MarkDrawerSaved()
        {
            _isBasicInfoDirty = false;
            _isHotkeyDirty = false;
            _isTrimDirty = false;
            _isPlaybackParamsDirty = false;
            _showSavedHeaderState = true;
            UpdateSaveAvailability();
        }

        private void ResetDrawerSaveStateFlags()
        {
            _isBasicInfoDirty = false;
            _isHotkeyDirty = false;
            _isTrimDirty = false;
            _isPlaybackParamsDirty = false;
            _showSavedHeaderState = false;
            UpdateSaveAvailability();
        }

        private bool HasPendingTagChanges(string cueId)
        {
            if (string.IsNullOrWhiteSpace(cueId))
            {
                return false;
            }

            var cueSeed = _allCueCards.FirstOrDefault(card => string.Equals(card.Id, cueId, StringComparison.Ordinal));
            if (cueSeed == null)
            {
                return false;
            }

            return !TagSetsEqual(GetEffectiveTags(cueSeed), GetCommittedTags(cueSeed));
        }

        private void UpdateDrawerHeaderState()
        {
            if (DrawerSubtitleText == null
                || DrawerSaveStateText == null
                || DrawerSaveStateBadge == null
                || SaveCueButton == null)
            {
                return;
            }

            if (string.IsNullOrWhiteSpace(_editingCueId))
            {
                DrawerSubtitleText.Text = "No cue selected";
                DrawerSaveStateText.Text = "No changes";
                DrawerSaveStateBadge.Background = new SolidColorBrush(Windows.UI.Color.FromArgb(255, 30, 41, 59));
                DrawerSaveStateBadge.BorderBrush = new SolidColorBrush(Windows.UI.Color.FromArgb(255, 51, 65, 85));
                SaveCueButton.Content = "Save";
                SaveCueButton.Background = new SolidColorBrush(Windows.UI.Color.FromArgb(255, 30, 41, 59));
                SaveCueButton.BorderBrush = new SolidColorBrush(Windows.UI.Color.FromArgb(255, 51, 65, 85));
                return;
            }

            var cueSeed = _allCueCards.FirstOrDefault(card => string.Equals(card.Id, _editingCueId, StringComparison.Ordinal));
            if (cueSeed != null)
            {
                DrawerSubtitleText.Text = "Selected: " + GetEffectiveTitle(cueSeed);
            }

            if (_showSavedHeaderState && !HasUnsavedChanges())
            {
                DrawerSaveStateText.Text = "Saved";
                DrawerSaveStateBadge.Background = new SolidColorBrush(Windows.UI.Color.FromArgb(255, 20, 83, 45));
                DrawerSaveStateBadge.BorderBrush = new SolidColorBrush(Windows.UI.Color.FromArgb(255, 34, 197, 94));
                SaveCueButton.Content = "Saved";
                SaveCueButton.Background = new SolidColorBrush(Windows.UI.Color.FromArgb(255, 20, 83, 45));
                SaveCueButton.BorderBrush = new SolidColorBrush(Windows.UI.Color.FromArgb(255, 34, 197, 94));
                return;
            }

            if (!HasUnsavedChanges())
            {
                DrawerSaveStateText.Text = "No changes";
                DrawerSaveStateBadge.Background = new SolidColorBrush(Windows.UI.Color.FromArgb(255, 30, 41, 59));
                DrawerSaveStateBadge.BorderBrush = new SolidColorBrush(Windows.UI.Color.FromArgb(255, 51, 65, 85));
                SaveCueButton.Content = "Save";
                SaveCueButton.Background = new SolidColorBrush(Windows.UI.Color.FromArgb(255, 30, 41, 59));
                SaveCueButton.BorderBrush = new SolidColorBrush(Windows.UI.Color.FromArgb(255, 51, 65, 85));
                return;
            }

            if (!_isBasicInfoValid || !_isHotkeyValid || !_isTrimValid)
            {
                DrawerSaveStateText.Text = "Cannot save";
                DrawerSaveStateBadge.Background = new SolidColorBrush(Windows.UI.Color.FromArgb(255, 69, 10, 10));
                DrawerSaveStateBadge.BorderBrush = new SolidColorBrush(Windows.UI.Color.FromArgb(255, 248, 113, 113));
                SaveCueButton.Content = "Save";
                SaveCueButton.Background = new SolidColorBrush(Windows.UI.Color.FromArgb(255, 69, 10, 10));
                SaveCueButton.BorderBrush = new SolidColorBrush(Windows.UI.Color.FromArgb(255, 248, 113, 113));
                return;
            }

            DrawerSaveStateText.Text = "Unsaved changes";
            DrawerSaveStateBadge.Background = new SolidColorBrush(Windows.UI.Color.FromArgb(255, 30, 64, 175));
            DrawerSaveStateBadge.BorderBrush = new SolidColorBrush(Windows.UI.Color.FromArgb(255, 96, 165, 250));
            SaveCueButton.Content = "Save";
            SaveCueButton.Background = new SolidColorBrush(Windows.UI.Color.FromArgb(255, 37, 99, 235));
            SaveCueButton.BorderBrush = new SolidColorBrush(Windows.UI.Color.FromArgb(255, 96, 165, 250));
        }

        private async Task<bool> ConfirmDiscardChangesAsync()
        {
            if (Content is not FrameworkElement root)
            {
                return false;
            }

            var dialog = new ContentDialog
            {
                Title = "Discard unsaved changes?",
                Content = "Current edits are only previewed until Save. Discarding closes the drawer and rolls back the pending changes.",
                PrimaryButtonText = "Discard changes",
                CloseButtonText = "Continue editing",
                DefaultButton = ContentDialogButton.Close,
                XamlRoot = root.XamlRoot,
            };

            var result = await dialog.ShowAsync();
            return result == ContentDialogResult.Primary;
        }

        private async Task<bool> ConfirmDeleteCueAsync(string cueTitle)
        {
            if (Content is not FrameworkElement root)
            {
                return false;
            }

            var dialog = new ContentDialog
            {
                Title = "Delete cue?",
                Content = "Delete " + cueTitle + "? This removes the cue from the current grid and closes the current drawer session.",
                PrimaryButtonText = "Delete cue",
                CloseButtonText = "Cancel",
                DefaultButton = ContentDialogButton.Close,
                XamlRoot = root.XamlRoot,
            };

            var result = await dialog.ShowAsync();
            return result == ContentDialogResult.Primary;
        }

        private void CommitBasicInfoDraft(string cueId)
        {
            if (string.IsNullOrWhiteSpace(cueId))
            {
                return;
            }

            if (_draftTitleOverrides.TryGetValue(cueId, out var draftTitle))
            {
                _savedTitleOverrides[cueId] = draftTitle;
                _draftTitleOverrides.Remove(cueId);
            }

            if (_draftTagsOverrides.TryGetValue(cueId, out var draftTags))
            {
                _savedTagsOverrides[cueId] = draftTags;
                _draftTagsOverrides.Remove(cueId);
            }

            if (_draftColorOverrides.TryGetValue(cueId, out var draftColor))
            {
                _savedColorOverrides[cueId] = draftColor;
                _draftColorOverrides.Remove(cueId);
            }
        }

        private void DiscardBasicInfoDraft(string cueId)
        {
            if (string.IsNullOrWhiteSpace(cueId))
            {
                return;
            }

            _draftTitleOverrides.Remove(cueId);
            _draftTagsOverrides.Remove(cueId);
            _draftColorOverrides.Remove(cueId);
            _isBasicInfoValid = true;
        }

        private void SetDraftTitle(CueCardSeed seed, string title)
        {
            if (string.IsNullOrWhiteSpace(seed.Id))
            {
                return;
            }

            if (string.Equals(title, GetCommittedTitle(seed), StringComparison.Ordinal))
            {
                _draftTitleOverrides.Remove(seed.Id);
                return;
            }

            _draftTitleOverrides[seed.Id] = title;
        }

        private void SetDraftTags(CueCardSeed seed, string[] tags)
        {
            if (string.IsNullOrWhiteSpace(seed.Id))
            {
                return;
            }

            if (TagSetsEqual(tags, GetCommittedTags(seed)))
            {
                _draftTagsOverrides.Remove(seed.Id);
                return;
            }

            _draftTagsOverrides[seed.Id] = tags;
        }

        private void SetDraftColor(CueCardSeed seed, string colorKey)
        {
            if (string.IsNullOrWhiteSpace(seed.Id))
            {
                return;
            }

            if (string.Equals(colorKey, GetCommittedColorKey(seed), StringComparison.OrdinalIgnoreCase))
            {
                _draftColorOverrides.Remove(seed.Id);
                return;
            }

            _draftColorOverrides[seed.Id] = colorKey;
        }

        private void RemoveCueOverrides(string cueId)
        {
            _draftTitleOverrides.Remove(cueId);
            _savedTitleOverrides.Remove(cueId);
            _draftTagsOverrides.Remove(cueId);
            _savedTagsOverrides.Remove(cueId);
            _draftColorOverrides.Remove(cueId);
            _savedColorOverrides.Remove(cueId);
            _draftHotkeyOverrides.Remove(cueId);
            _savedHotkeyOverrides.Remove(cueId);
            _draftCueVolumeOverrides.Remove(cueId);
            _savedCueVolumeOverrides.Remove(cueId);
            _draftCuePlaybackRateOverrides.Remove(cueId);
            _savedCuePlaybackRateOverrides.Remove(cueId);
            _draftTrimOverrides.Remove(cueId);
            _savedTrimOverrides.Remove(cueId);
        }

        private string GetEffectiveTitle(CueCardSeed seed)
        {
            if (_draftTitleOverrides.TryGetValue(seed.Id, out var draftTitle))
            {
                return draftTitle;
            }

            if (_savedTitleOverrides.TryGetValue(seed.Id, out var savedTitle))
            {
                return savedTitle;
            }

            return seed.Title;
        }

        private string GetCommittedTitle(CueCardSeed seed)
        {
            if (_savedTitleOverrides.TryGetValue(seed.Id, out var savedTitle))
            {
                return savedTitle;
            }

            return seed.Title;
        }

        private IReadOnlyList<string> GetEffectiveTags(CueCardSeed seed)
        {
            if (_draftTagsOverrides.TryGetValue(seed.Id, out var draftTags))
            {
                return draftTags;
            }

            if (_savedTagsOverrides.TryGetValue(seed.Id, out var savedTags))
            {
                return savedTags;
            }

            return seed.Tags;
        }

        private IReadOnlyList<string> GetCommittedTags(CueCardSeed seed)
        {
            if (_savedTagsOverrides.TryGetValue(seed.Id, out var savedTags))
            {
                return savedTags;
            }

            return seed.Tags;
        }

        private string GetEffectiveColorKey(CueCardSeed seed)
        {
            if (_draftColorOverrides.TryGetValue(seed.Id, out var draftColor))
            {
                return draftColor;
            }

            if (_savedColorOverrides.TryGetValue(seed.Id, out var savedColor))
            {
                return savedColor;
            }

            return GetDefaultColorKey(seed);
        }

        private string GetCommittedColorKey(CueCardSeed seed)
        {
            if (_savedColorOverrides.TryGetValue(seed.Id, out var savedColor))
            {
                return savedColor;
            }

            return GetDefaultColorKey(seed);
        }

        private void SyncBasicInfoDirtyState(CueCardSeed seed)
        {
            var currentName = (CueNameTextBox?.Text ?? string.Empty).Trim();
            var currentTags = ParseTags(CueTagsTextBox?.Text);
            var currentColorKey = GetEffectiveColorKey(seed);

            var hasNameChange = !string.Equals(currentName, GetCommittedTitle(seed), StringComparison.Ordinal);
            var hasTagChange = !TagSetsEqual(currentTags, GetCommittedTags(seed));
            var hasColorChange = !string.Equals(currentColorKey, GetCommittedColorKey(seed), StringComparison.OrdinalIgnoreCase);

            _isBasicInfoDirty = hasNameChange || hasTagChange || hasColorChange;
            if (_isBasicInfoDirty)
            {
                _showSavedHeaderState = false;
            }

            UpdateSaveAvailability();
        }

        private static bool TagSetsEqual(IReadOnlyList<string> left, IReadOnlyList<string> right)
        {
            if (left.Count != right.Count)
            {
                return false;
            }

            for (var i = 0; i < left.Count; i++)
            {
                if (!string.Equals(left[i], right[i], StringComparison.OrdinalIgnoreCase))
                {
                    return false;
                }
            }

            return true;
        }

        private static string[] ParseTags(string? tagText)
        {
            return (tagText ?? string.Empty)
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(tag => !string.IsNullOrWhiteSpace(tag))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }

        private static string BuildResourceFileName(CueCardSeed seed)
        {
            if (!string.IsNullOrWhiteSpace(seed.ResourceName))
            {
                return seed.ResourceName;
            }

            var slug = seed.Title
                .ToLowerInvariant()
                .Replace(" ", "-", StringComparison.Ordinal)
                .Replace("'", string.Empty, StringComparison.Ordinal);
            return slug + ".wav";
        }

        private string BuildNextCueId()
        {
            var nextIndex = _allCueCards
                .Select(card => card.Id)
                .Select(id => id.StartsWith("cue-", StringComparison.OrdinalIgnoreCase)
                    && int.TryParse(id.AsSpan(4), NumberStyles.Integer, CultureInfo.InvariantCulture, out var value)
                        ? value
                        : 0)
                .DefaultIfEmpty()
                .Max() + 1;
            return "cue-" + nextIndex.ToString("00", CultureInfo.InvariantCulture);
        }

        private CueCardRecord BuildPlaybackCueRecord(CueCardSeed seed)
        {
            var effectiveTrim = GetEffectiveTrimRange(seed);
            double? trimEnd = effectiveTrim.EndSeconds >= seed.TotalDurationSeconds - 0.001
                ? null
                : effectiveTrim.EndSeconds;

            return new CueCardRecord(
                seed.Id,
                seed.Id,
                GetEffectiveTitle(seed),
                seed.ResourceName,
                seed.ResourcePath,
                GetEffectiveColorKey(seed),
                GetEffectiveHotkeyDisplay(seed),
                GetEffectiveCueVolumePercent(seed) / 100d,
                GetEffectiveCuePlaybackRate(seed),
                effectiveTrim.StartSeconds,
                trimEnd,
                0,
                GetEffectiveTags(seed),
                !File.Exists(seed.ResourcePath),
                false);
        }

        private bool TryCreateImportedCueSeed(string filePath, out CueCardSeed cueSeed)
        {
            cueSeed = null!;
            if (!File.Exists(filePath) || !IsSupportedAudioFilePath(filePath))
            {
                return false;
            }

            if (_allCueCards.Any(card =>
                card.Kind == CueCardKind.Imported
                && string.Equals(card.ResourcePath, filePath, StringComparison.OrdinalIgnoreCase)))
            {
                return false;
            }

            double totalDurationSeconds;
            try
            {
                using var reader = new NAudio.Wave.AudioFileReader(filePath);
                totalDurationSeconds = Math.Max(DefaultCueTotalDurationSeconds, reader.TotalTime.TotalSeconds);
            }
            catch
            {
                return false;
            }

            var cueId = BuildNextCueId();
            cueSeed = new CueCardSeed(
                cueId,
                CueCardKind.Imported,
                Path.GetFileNameWithoutExtension(filePath),
                "--",
                CardColorCycle[_allCueCards.Count(card => card.Kind == CueCardKind.Imported) % CardColorCycle.Length],
                filePath,
                Path.GetFileName(filePath),
                totalDurationSeconds);
            return true;
        }

        private static bool IsSupportedAudioFilePath(string filePath)
        {
            var extension = Path.GetExtension(filePath);
            return extension.Equals(".mp3", StringComparison.OrdinalIgnoreCase)
                || extension.Equals(".wav", StringComparison.OrdinalIgnoreCase)
                || extension.Equals(".ogg", StringComparison.OrdinalIgnoreCase)
                || extension.Equals(".aac", StringComparison.OrdinalIgnoreCase)
                || extension.Equals(".flac", StringComparison.OrdinalIgnoreCase)
                || extension.Equals(".m4a", StringComparison.OrdinalIgnoreCase)
                || extension.Equals(".webm", StringComparison.OrdinalIgnoreCase);
        }

        private string BuildDuplicateTitle(string sourceTitle)
        {
            var baseTitle = sourceTitle + " copy";
            var title = baseTitle;
            var suffix = 2;
            while (_allCueCards.Any(card => string.Equals(GetEffectiveTitle(card), title, StringComparison.OrdinalIgnoreCase)))
            {
                title = baseTitle + " " + suffix.ToString(CultureInfo.InvariantCulture);
                suffix++;
            }

            return title;
        }

        private static string GetDefaultColorKey(CueCardSeed seed)
        {
            return string.IsNullOrWhiteSpace(seed.DefaultColorKey) ? "slate" : seed.DefaultColorKey;
        }

        private static string GetColorDisplayName(string colorKey)
        {
            return colorKey switch
            {
                "slate" => "Slate",
                "red" => "Red",
                "orange" => "Orange",
                "amber" => "Amber",
                "lime" => "Lime",
                "emerald" => "Emerald",
                "sky" => "Sky",
                "indigo" => "Indigo",
                "rose" => "Rose",
                _ => "Slate",
            };
        }

        private static Brush CreateAccentBrush(string colorKey)
        {
            return new SolidColorBrush(GetCardColor(colorKey));
        }

        private static Brush CreateCardBackgroundBrush(string colorKey, bool isPlaying, bool isEditing, bool hasDraftPreview)
        {
            var baseColor = GetCardColor(colorKey);
            var alpha = hasDraftPreview ? (byte)108 : isPlaying ? (byte)118 : isEditing ? (byte)98 : (byte)82;
            return new SolidColorBrush(Windows.UI.Color.FromArgb(alpha, baseColor.R, baseColor.G, baseColor.B));
        }

        private static Brush CreateCardBorderBrush(string colorKey, bool isPlaying, bool isEditing, bool hasDraftPreview)
        {
            if (hasDraftPreview)
            {
                return new SolidColorBrush(Windows.UI.Color.FromArgb(255, 245, 158, 11));
            }

            if (isPlaying)
            {
                return new SolidColorBrush(Windows.UI.Color.FromArgb(255, 191, 219, 254));
            }

            if (isEditing)
            {
                return new SolidColorBrush(Windows.UI.Color.FromArgb(255, 147, 197, 253));
            }

            var baseColor = GetCardColor(colorKey);
            return new SolidColorBrush(Windows.UI.Color.FromArgb(220, baseColor.R, baseColor.G, baseColor.B));
        }

        private static Windows.UI.Color GetCardColor(string colorKey)
        {
            return colorKey switch
            {
                "slate" => Windows.UI.Color.FromArgb(255, 100, 116, 139),
                "red" => Windows.UI.Color.FromArgb(255, 239, 68, 68),
                "orange" => Windows.UI.Color.FromArgb(255, 249, 115, 22),
                "amber" => Windows.UI.Color.FromArgb(255, 245, 158, 11),
                "lime" => Windows.UI.Color.FromArgb(255, 132, 204, 22),
                "emerald" => Windows.UI.Color.FromArgb(255, 16, 185, 129),
                "sky" => Windows.UI.Color.FromArgb(255, 14, 165, 233),
                "indigo" => Windows.UI.Color.FromArgb(255, 99, 102, 241),
                "rose" => Windows.UI.Color.FromArgb(255, 244, 63, 94),
                _ => Windows.UI.Color.FromArgb(255, 100, 116, 139),
            };
        }

        private void ExitHotkeyRecording()
        {
            _isRecordingHotkey = false;
            if (RecordHotkeyButton != null)
            {
                RecordHotkeyButton.Content = "Record hotkey";
            }
        }

        private void UpdateHotkeyEditorState()
        {
            if (string.IsNullOrWhiteSpace(_editingCueId)
                || CueHotkeyTextBox == null
                || HotkeyStateText == null
                || HotkeyValidationText == null)
            {
                return;
            }

            var cueSeed = _allCueCards.FirstOrDefault(card => string.Equals(card.Id, _editingCueId, StringComparison.Ordinal));
            if (cueSeed == null)
            {
                return;
            }

            CueHotkeyTextBox.Text = GetEffectiveHotkeyDisplay(cueSeed);
            if (!_isRecordingHotkey && HotkeyValidationText.Visibility != Visibility.Visible)
            {
                HotkeyStateText.Text = string.IsNullOrWhiteSpace(CueHotkeyTextBox.Text) || CueHotkeyTextBox.Text == "Not assigned"
                    ? "No hotkey assigned. Save rebuilds registration with this slot cleared."
                    : "Hotkey display order is fixed: Ctrl + Alt + Shift + Key.";
            }

            UpdateSaveAvailability();
        }

        private void CommitHotkeyDraft(string cueId)
        {
            if (string.IsNullOrWhiteSpace(cueId))
            {
                return;
            }

            if (!_draftHotkeyOverrides.TryGetValue(cueId, out var draftHotkey))
            {
                return;
            }

            _savedHotkeyOverrides[cueId] = draftHotkey;
            _draftHotkeyOverrides.Remove(cueId);
            RebuildGlobalHotkeyRegistrations();
            _isHotkeyDirty = false;
            _isHotkeyValid = true;
            HotkeyValidationText.Visibility = Visibility.Collapsed;
            HotkeyStateText.Text = string.IsNullOrWhiteSpace(draftHotkey)
                ? "Hotkey cleared. Save removed the global registration for this cue."
                : "Hotkey saved. Global registration rebuilt for future triggers.";
            UpdateSaveAvailability();
        }

        private void DiscardHotkeyDraft(string cueId)
        {
            if (string.IsNullOrWhiteSpace(cueId))
            {
                return;
            }

            if (_draftHotkeyOverrides.Remove(cueId))
            {
                _isHotkeyDirty = false;
                _isHotkeyValid = true;
                HotkeyValidationText.Visibility = Visibility.Collapsed;
                UpdateSaveAvailability();
            }
        }

        private void SetDraftHotkey(CueCardSeed seed, string display)
        {
            if (string.IsNullOrWhiteSpace(seed.Id))
            {
                return;
            }

            if (string.Equals(display, GetCommittedHotkeyDisplay(seed), StringComparison.OrdinalIgnoreCase))
            {
                _draftHotkeyOverrides.Remove(seed.Id);
                return;
            }

            _draftHotkeyOverrides[seed.Id] = display;
        }

        private string GetEffectiveHotkeyDisplay(CueCardSeed seed)
        {
            if (_draftHotkeyOverrides.TryGetValue(seed.Id, out var draftHotkey))
            {
                return string.IsNullOrWhiteSpace(draftHotkey) ? "Not assigned" : draftHotkey;
            }

            if (_savedHotkeyOverrides.TryGetValue(seed.Id, out var savedHotkey))
            {
                return string.IsNullOrWhiteSpace(savedHotkey) ? "Not assigned" : savedHotkey;
            }

            return NormalizeSeedHotkey(seed.Hotkey);
        }

        private string GetCommittedHotkeyDisplay(CueCardSeed seed)
        {
            if (_savedHotkeyOverrides.TryGetValue(seed.Id, out var savedHotkey))
            {
                return string.IsNullOrWhiteSpace(savedHotkey) ? "Not assigned" : savedHotkey;
            }

            return NormalizeSeedHotkey(seed.Hotkey);
        }

        private void SyncHotkeyDirtyState(CueCardSeed seed)
        {
            _isHotkeyDirty = !string.Equals(GetEffectiveHotkeyDisplay(seed), GetCommittedHotkeyDisplay(seed), StringComparison.OrdinalIgnoreCase);
            if (_isHotkeyDirty)
            {
                _showSavedHeaderState = false;
            }

            UpdateSaveAvailability();
        }

        private static string NormalizeSeedHotkey(string hotkey)
        {
            if (string.IsNullOrWhiteSpace(hotkey) || hotkey == "--")
            {
                return "Not assigned";
            }

            return hotkey.Replace("+", " + ", StringComparison.Ordinal);
        }

        private bool TryFindHotkeyConflict(string cueId, string capturedDisplay, out string conflictTitle)
        {
            conflictTitle = string.Empty;
            foreach (var cue in _allCueCards.Where(card => card.Kind == CueCardKind.Imported && !string.Equals(card.Id, cueId, StringComparison.Ordinal)))
            {
                var hotkeyDisplay = GetEffectiveHotkeyDisplay(cue);
                if (string.Equals(hotkeyDisplay, capturedDisplay, StringComparison.OrdinalIgnoreCase))
                {
                    conflictTitle = GetEffectiveTitle(cue);
                    return true;
                }
            }

            return false;
        }

        private void RebuildGlobalHotkeyRegistrations()
        {
            UnregisterAllGlobalHotkeys();
            _registeredGlobalHotkeys.Clear();
            if (!_globalHotkeysEnabled || _windowHandle == nint.Zero)
            {
                return;
            }

            var hotkeyId = 1;
            foreach (var cue in _allCueCards.Where(card => card.Kind == CueCardKind.Imported))
            {
                var committedHotkey = GetCommittedHotkeyDisplay(cue);
                if (string.IsNullOrWhiteSpace(committedHotkey) || string.Equals(committedHotkey, "Not assigned", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                if (!TryParseRegisteredHotkey(committedHotkey, out var modifiers, out var virtualKey))
                {
                    continue;
                }

                if (!RegisterHotKey(_windowHandle, hotkeyId, modifiers | ModNoRepeat, virtualKey))
                {
                    continue;
                }

                _registeredGlobalHotkeys[cue.Id] = committedHotkey;
                _registeredHotkeyIdsByCueId[cue.Id] = hotkeyId;
                _registeredCueIdsByHotkeyId[hotkeyId] = cue.Id;
                hotkeyId++;
            }

            _globalHotkeyRegistrationRevision++;
        }

        private void HandleRegisteredHotkey(int hotkeyId)
        {
            if (!_registeredCueIdsByHotkeyId.TryGetValue(hotkeyId, out var cueId))
            {
                return;
            }

            var cueSeed = _allCueCards.FirstOrDefault(card => string.Equals(card.Id, cueId, StringComparison.Ordinal));
            if (cueSeed == null)
            {
                return;
            }

            _ = DispatcherQueue.TryEnqueue(async () =>
            {
                await TryPlayCueAsync(cueSeed, "Global hotkey plays ");
            });
        }

        private void UnregisterAllGlobalHotkeys()
        {
            if (_windowHandle != nint.Zero)
            {
                foreach (var hotkeyId in _registeredCueIdsByHotkeyId.Keys.ToList())
                {
                    UnregisterHotKey(_windowHandle, hotkeyId);
                }
            }

            _registeredHotkeyIdsByCueId.Clear();
            _registeredCueIdsByHotkeyId.Clear();
        }

        private static bool TryParseRegisteredHotkey(string display, out uint modifiers, out uint virtualKey)
        {
            modifiers = 0;
            virtualKey = 0;
            if (string.IsNullOrWhiteSpace(display))
            {
                return false;
            }

            var parts = display
                .Split('+', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .ToList();

            if (parts.Count < 2)
            {
                return false;
            }

            foreach (var part in parts.Take(parts.Count - 1))
            {
                if (part.Equals("Ctrl", StringComparison.OrdinalIgnoreCase))
                {
                    modifiers |= ModControl;
                }
                else if (part.Equals("Alt", StringComparison.OrdinalIgnoreCase))
                {
                    modifiers |= ModAlt;
                }
                else if (part.Equals("Shift", StringComparison.OrdinalIgnoreCase))
                {
                    modifiers |= ModShift;
                }
            }

            if (modifiers == 0)
            {
                return false;
            }

            var primaryKey = parts[^1];
            if (primaryKey.Length == 1 && char.IsLetter(primaryKey[0]))
            {
                virtualKey = (uint)char.ToUpperInvariant(primaryKey[0]);
                return true;
            }

            if (primaryKey.Length == 1 && char.IsDigit(primaryKey[0]))
            {
                virtualKey = 0x30u + (uint)(primaryKey[0] - '0');
                return true;
            }

            if (primaryKey.StartsWith("F", StringComparison.OrdinalIgnoreCase)
                && int.TryParse(primaryKey[1..], out var functionKey)
                && functionKey is >= 1 and <= 24)
            {
                virtualKey = (uint)VirtualKey.F1 + (uint)(functionKey - 1);
                return true;
            }

            return false;
        }

        private string? TryBuildCapturedHotkeyDisplay(VirtualKey key)
        {
            var primaryKey = GetSupportedPrimaryKeyDisplay(key);
            if (primaryKey == null)
            {
                return null;
            }

            var parts = new List<string>();
            if (IsModifierPressed(VirtualKey.Control))
            {
                parts.Add("Ctrl");
            }

            if (IsModifierPressed(VirtualKey.Menu))
            {
                parts.Add("Alt");
            }

            if (IsModifierPressed(VirtualKey.Shift))
            {
                parts.Add("Shift");
            }

            if (parts.Count == 0)
            {
                return null;
            }

            parts.Add(primaryKey);
            return string.Join(" + ", parts);
        }

        private static string? GetSupportedPrimaryKeyDisplay(VirtualKey key)
        {
            if (key >= VirtualKey.A && key <= VirtualKey.Z)
            {
                return key.ToString().ToUpperInvariant();
            }

            if (key >= VirtualKey.Number0 && key <= VirtualKey.Number9)
            {
                return ((int)key - (int)VirtualKey.Number0).ToString(CultureInfo.InvariantCulture);
            }

            if (key >= VirtualKey.F1 && key <= VirtualKey.F12)
            {
                return key.ToString().ToUpperInvariant();
            }

            return null;
        }

        private static bool IsModifierPressed(VirtualKey key)
        {
            return (GetKeyState((int)key) & 0x8000) != 0;
        }

        private void BuildTagFilterPanel()
        {
            if (TagFilterPanel == null)
            {
                return;
            }

            TagFilterPanel.Children.Clear();

            var tagRecords = BuildTagRecords().ToList();
            if (!string.IsNullOrWhiteSpace(_selectedTag)
                && !tagRecords.Any(tag => string.Equals(tag.Name, _selectedTag, StringComparison.OrdinalIgnoreCase)))
            {
                tagRecords.Add(new TagRecord(_selectedTag, _selectedTag + " (0)"));
            }

            if (tagRecords.Count == 0)
            {
                TagFilterPanel.Children.Add(new TextBlock
                {
                    Foreground = new SolidColorBrush(Windows.UI.Color.FromArgb(255, 100, 116, 139)),
                    Text = "No tags yet",
                    TextWrapping = TextWrapping.WrapWholeWords
                });
                UpdateAllCardsButtonState();
                return;
            }

            foreach (var tag in tagRecords)
            {
                TagFilterPanel.Children.Add(CreateTagFilterButton(tag));
            }

            UpdateAllCardsButtonState();
            UpdateTagFilterButtonState();
        }

        private IReadOnlyList<TagRecord> BuildTagRecords()
        {
            return _allCueCards
                .Where(card => card.Kind == CueCardKind.Imported)
                .SelectMany(card => GetEffectiveTags(card))
                .GroupBy(tag => tag, StringComparer.OrdinalIgnoreCase)
                .OrderBy(group => group.Key, StringComparer.CurrentCultureIgnoreCase)
                .Select(group => new TagRecord(group.Key, group.Key + " (" + group.Count().ToString() + ")"))
                .ToList();
        }

        private void UpdateAllCardsButtonState()
        {
            if (AllCardsFilterButton == null)
            {
                return;
            }

            var isActive = string.IsNullOrWhiteSpace(_selectedTag);
            AllCardsFilterButton.Background = new SolidColorBrush(isActive
                ? Windows.UI.Color.FromArgb(255, 37, 99, 235)
                : Windows.UI.Color.FromArgb(255, 24, 33, 43));
            AllCardsFilterButton.Foreground = new SolidColorBrush(isActive
                ? Colors.White
                : Windows.UI.Color.FromArgb(255, 229, 231, 235));
            AllCardsFilterButton.BorderBrush = new SolidColorBrush(isActive
                ? Windows.UI.Color.FromArgb(255, 96, 165, 250)
                : Windows.UI.Color.FromArgb(255, 43, 54, 67));
        }

        private void UpdateTagFilterButtonState()
        {
            if (TagFilterPanel == null)
            {
                return;
            }

            foreach (var child in TagFilterPanel.Children)
            {
                var button = child as Button;
                var tagName = button?.Tag as string;
                if (button == null || tagName == null)
                {
                    continue;
                }

                var isActive = string.Equals(tagName, _selectedTag, StringComparison.OrdinalIgnoreCase);
                button.Background = new SolidColorBrush(isActive
                    ? Windows.UI.Color.FromArgb(255, 37, 99, 235)
                    : Windows.UI.Color.FromArgb(255, 24, 33, 43));
                button.Foreground = new SolidColorBrush(isActive
                    ? Colors.White
                    : Windows.UI.Color.FromArgb(255, 229, 231, 235));
                button.BorderBrush = new SolidColorBrush(isActive
                    ? Windows.UI.Color.FromArgb(255, 96, 165, 250)
                    : Windows.UI.Color.FromArgb(255, 43, 54, 67));
            }
        }

        private void RefreshTagFilterSelectionState()
        {
            UpdateAllCardsButtonState();
            UpdateTagFilterButtonState();
        }

        private Button CreateTagFilterButton(TagRecord tag)
        {
            var button = new Button
            {
                Content = tag.Label,
                Tag = tag.Name,
                HorizontalAlignment = HorizontalAlignment.Stretch,
                HorizontalContentAlignment = HorizontalAlignment.Left,
                MinHeight = 36,
                Padding = new Thickness(12, 8, 12, 8)
            };
            button.Click += TagFilterButton_Click;
            return button;
        }

        private CueCardStub BuildImportedCard(CueCardSeed seed)
        {
            var isPlaying = _isPlaying && string.Equals(seed.Id, _activePlayingCueId, StringComparison.Ordinal);
            var isEditing = IsEditorDrawerOpen
                && string.Equals(seed.Id, _editingCueId, StringComparison.Ordinal);
            var hasDraftPreview = isEditing && HasUnsavedChanges();
            var effectiveColorKey = GetEffectiveColorKey(seed);
            var statusText = isPlaying
                ? "Playing"
                : hasDraftPreview
                    ? "Draft"
                    : isEditing
                        ? "Editing"
                        : "Ready";
            var hotkeyBrush = hasDraftPreview
                ? Windows.UI.Color.FromArgb(255, 253, 230, 138)
                : isPlaying
                    ? Windows.UI.Color.FromArgb(255, 191, 219, 254)
                    : isEditing
                        ? Windows.UI.Color.FromArgb(255, 147, 197, 253)
                        : Windows.UI.Color.FromArgb(255, 148, 163, 184);
            var statusBackground = statusText switch
            {
                "Playing" => Windows.UI.Color.FromArgb(255, 30, 64, 175),
                "Draft" => Windows.UI.Color.FromArgb(255, 120, 53, 15),
                "Editing" => Windows.UI.Color.FromArgb(255, 30, 41, 59),
                _ => Windows.UI.Color.FromArgb(255, 51, 65, 85),
            };
            var statusForeground = statusText switch
            {
                "Draft" => Windows.UI.Color.FromArgb(255, 254, 243, 199),
                "Editing" => Windows.UI.Color.FromArgb(255, 191, 219, 254),
                "Playing" => Colors.White,
                _ => Windows.UI.Color.FromArgb(255, 203, 213, 225),
            };
            return new CueCardStub(
                seed.Id,
                seed.Kind,
                GetEffectiveTitle(seed),
                GetEffectiveHotkeyDisplay(seed),
                statusText,
                true,
                1.0,
                isPlaying ? new Thickness(2) : new Thickness(1),
                CreateCardBackgroundBrush(effectiveColorKey, isPlaying, isEditing, hasDraftPreview),
                CreateCardBorderBrush(effectiveColorKey, isPlaying, isEditing, hasDraftPreview),
                CreateAccentBrush(effectiveColorKey),
                new SolidColorBrush(Colors.White),
                new SolidColorBrush(hotkeyBrush),
                new SolidColorBrush(statusBackground),
                new SolidColorBrush(statusForeground));
        }

        private static CueCardStub BuildPlaceholderCard(CueCardSeed seed)
        {
            return new CueCardStub(
                seed.Id,
                seed.Kind,
                seed.Title,
                seed.Hotkey,
                "Placeholder",
                false,
                0.72,
                new Thickness(1),
                new SolidColorBrush(Windows.UI.Color.FromArgb(255, 21, 28, 36)),
                new SolidColorBrush(Windows.UI.Color.FromArgb(255, 50, 62, 75)),
                new SolidColorBrush(Windows.UI.Color.FromArgb(255, 100, 116, 139)),
                new SolidColorBrush(Windows.UI.Color.FromArgb(255, 148, 163, 184)),
                new SolidColorBrush(Windows.UI.Color.FromArgb(255, 100, 116, 139)),
                new SolidColorBrush(Windows.UI.Color.FromArgb(255, 30, 41, 59)),
                new SolidColorBrush(Windows.UI.Color.FromArgb(255, 148, 163, 184)));
        }

        private sealed class CueCardSeed
        {
            public CueCardSeed(
                string id,
                CueCardKind kind,
                string title,
                string hotkey,
                string defaultColorKey,
                string resourcePath = "",
                string resourceName = "",
                double totalDurationSeconds = DefaultCueTotalDurationSeconds,
                params string[] tags)
            {
                Id = id;
                Kind = kind;
                Title = title;
                Hotkey = hotkey;
                DefaultColorKey = defaultColorKey;
                ResourcePath = resourcePath ?? string.Empty;
                ResourceName = resourceName ?? string.Empty;
                TotalDurationSeconds = Math.Max(MinimumTrimDurationSeconds, totalDurationSeconds);
                Tags = tags ?? Array.Empty<string>();
            }

            public string Id { get; }

            public CueCardKind Kind { get; }

            public string Title { get; }

            public string Hotkey { get; }

            public string DefaultColorKey { get; }

            public string ResourcePath { get; }

            public string ResourceName { get; }

            public double TotalDurationSeconds { get; }

            public bool HasPlayableAudio => !string.IsNullOrWhiteSpace(ResourcePath) && File.Exists(ResourcePath);

            public IReadOnlyList<string> Tags { get; }
        }

        private sealed class TagRecord
        {
            public TagRecord(string name, string label)
            {
                Name = name;
                Label = label;
            }

            public string Name { get; }

            public string Label { get; }
        }

        private sealed class CueCardStub : INotifyPropertyChanged
        {
            public CueCardStub(
                string id,
                CueCardKind kind,
                string title,
                string hotkey,
                string statusText,
                bool isInteractive,
                double cardOpacity,
                Thickness cardBorderThickness,
                Brush cardBackground,
                Brush cardBorderBrush,
                Brush accentBrush,
                Brush titleBrush,
                Brush hotkeyBrush,
                Brush statusBackground,
                Brush statusForeground)
            {
                Id = id;
                Kind = kind;
                _title = title;
                _hotkey = hotkey;
                _statusText = statusText;
                IsInteractive = isInteractive;
                _cardOpacity = cardOpacity;
                _cardBorderThickness = cardBorderThickness;
                _cardBackground = cardBackground;
                _cardBorderBrush = cardBorderBrush;
                _accentBrush = accentBrush;
                _titleBrush = titleBrush;
                _hotkeyBrush = hotkeyBrush;
                _statusBackground = statusBackground;
                _statusForeground = statusForeground;
            }

            public event PropertyChangedEventHandler? PropertyChanged;

            public string Id { get; }

            public CueCardKind Kind { get; }

            private string _title;
            public string Title
            {
                get => _title;
                private set => SetProperty(ref _title, value, nameof(Title));
            }

            private string _hotkey;
            public string Hotkey
            {
                get => _hotkey;
                private set => SetProperty(ref _hotkey, value, nameof(Hotkey));
            }

            private string _statusText;
            public string StatusText
            {
                get => _statusText;
                private set => SetProperty(ref _statusText, value, nameof(StatusText));
            }

            public bool IsInteractive { get; }

            private double _cardOpacity;
            public double CardOpacity
            {
                get => _cardOpacity;
                private set => SetProperty(ref _cardOpacity, value, nameof(CardOpacity));
            }

            private Thickness _cardBorderThickness;
            public Thickness CardBorderThickness
            {
                get => _cardBorderThickness;
                private set => SetProperty(ref _cardBorderThickness, value, nameof(CardBorderThickness));
            }

            private Brush _cardBackground;
            public Brush CardBackground
            {
                get => _cardBackground;
                private set => SetProperty(ref _cardBackground, value, nameof(CardBackground));
            }

            private Brush _cardBorderBrush;
            public Brush CardBorderBrush
            {
                get => _cardBorderBrush;
                private set => SetProperty(ref _cardBorderBrush, value, nameof(CardBorderBrush));
            }

            private Brush _accentBrush;
            public Brush AccentBrush
            {
                get => _accentBrush;
                private set => SetProperty(ref _accentBrush, value, nameof(AccentBrush));
            }

            private Brush _titleBrush;
            public Brush TitleBrush
            {
                get => _titleBrush;
                private set => SetProperty(ref _titleBrush, value, nameof(TitleBrush));
            }

            private Brush _hotkeyBrush;
            public Brush HotkeyBrush
            {
                get => _hotkeyBrush;
                private set => SetProperty(ref _hotkeyBrush, value, nameof(HotkeyBrush));
            }

            private Brush _statusBackground;
            public Brush StatusBackground
            {
                get => _statusBackground;
                private set => SetProperty(ref _statusBackground, value, nameof(StatusBackground));
            }

            private Brush _statusForeground;
            public Brush StatusForeground
            {
                get => _statusForeground;
                private set => SetProperty(ref _statusForeground, value, nameof(StatusForeground));
            }

            public void ApplyFrom(CueCardStub nextState)
            {
                Title = nextState.Title;
                Hotkey = nextState.Hotkey;
                StatusText = nextState.StatusText;
                CardOpacity = nextState.CardOpacity;
                CardBorderThickness = nextState.CardBorderThickness;
                CardBackground = nextState.CardBackground;
                CardBorderBrush = nextState.CardBorderBrush;
                AccentBrush = nextState.AccentBrush;
                TitleBrush = nextState.TitleBrush;
                HotkeyBrush = nextState.HotkeyBrush;
                StatusBackground = nextState.StatusBackground;
                StatusForeground = nextState.StatusForeground;
            }

            private void SetProperty<T>(ref T storage, T value, string propertyName)
            {
                if (EqualityComparer<T>.Default.Equals(storage, value))
                {
                    return;
                }

                storage = value;
                PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
            }
        }

        private readonly struct TrimRange
        {
            public TrimRange(double startSeconds, double endSeconds)
            {
                StartSeconds = startSeconds;
                EndSeconds = endSeconds;
            }

            public double StartSeconds { get; }

            public double EndSeconds { get; }
        }

        private enum TrimDragHandle
        {
            None,
            Start,
            End,
        }

        private enum CueCardKind
        {
            Imported,
            Placeholder,
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct POINT
        {
            public int x;
            public int y;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct MINMAXINFO
        {
            public POINT ptReserved;
            public POINT ptMaxSize;
            public POINT ptMaxPosition;
            public POINT ptMinTrackSize;
            public POINT ptMaxTrackSize;
        }

        private delegate nint SubclassProc(nint hwnd, uint message, nuint wParam, nint lParam, nuint subclassId, nuint refData);

        [DllImport("comctl32.dll", SetLastError = true)]
        private static extern bool SetWindowSubclass(
            nint hWnd,
            SubclassProc callback,
            nuint subclassId,
            nuint refData);

        [DllImport("comctl32.dll", SetLastError = true)]
        private static extern bool RemoveWindowSubclass(
            nint hWnd,
            SubclassProc callback,
            nuint subclassId);

        [DllImport("comctl32.dll")]
        private static extern nint DefSubclassProc(nint hWnd, uint message, nuint wParam, nint lParam);

        [DllImport("user32.dll")]
        private static extern uint GetDpiForWindow(nint hWnd);

        [DllImport("user32.dll")]
        private static extern short GetKeyState(int virtualKey);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool RegisterHotKey(nint hWnd, int id, uint fsModifiers, uint vk);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool UnregisterHotKey(nint hWnd, int id);

        [DllImport("shell32.dll")]
        private static extern void DragAcceptFiles(nint hWnd, bool fAccept);

        [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
        private static extern uint DragQueryFile(nint hDrop, uint iFile, System.Text.StringBuilder? lpszFile, uint cch);

        [DllImport("shell32.dll")]
        private static extern void DragFinish(nint hDrop);

        [DllImport("kernel32.dll")]
        private static extern int MulDiv(int number, int numerator, int denominator);
    }
}
