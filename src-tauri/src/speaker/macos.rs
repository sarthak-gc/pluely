// Pluely macos speaker input and stream — STUB BUILD
//
// The real implementation captures system audio through a CoreAudio process tap
// via the `cidre` crate. `cidre`'s build script invokes `xcodebuild` to compile
// its bundled `pomace` Objective-C project, which requires a full Xcode install
// (CommandLineTools alone is not enough). This stub drops that dependency so the
// app builds and runs without Xcode, at the cost of system-audio capture.
//
// To restore the real implementation once Xcode is installed:
//   git checkout src-tauri/src/speaker/macos.rs src-tauri/Cargo.toml
use super::AudioDevice;
use anyhow::Result;
use cpal::traits::{DeviceTrait, HostTrait};
use futures_util::Stream;
use std::pin::Pin;
use std::task::{Context, Poll};

// Enumeration originally went through cidre's CoreAudio bindings. cpal reaches
// the same CoreAudio device list through plain FFI, so the picker still works
// without Xcode. cpal exposes no CoreAudio UID, so the device name is the id —
// the frontend only round-trips this value back to us, and getUserMedia never
// accepted the UIDs anyway.
fn collect_devices(kind: DeviceKind) -> Result<Vec<AudioDevice>> {
    let host = cpal::default_host();

    let (devices, default_name) = match kind {
        DeviceKind::Input => (
            host.input_devices()?.collect::<Vec<_>>(),
            host.default_input_device().and_then(|d| d.name().ok()),
        ),
        DeviceKind::Output => (
            host.output_devices()?.collect::<Vec<_>>(),
            host.default_output_device().and_then(|d| d.name().ok()),
        ),
    };

    Ok(devices
        .iter()
        .filter_map(|device| device.name().ok())
        .map(|name| AudioDevice {
            is_default: default_name.as_deref() == Some(name.as_str()),
            id: name.clone(),
            name,
        })
        .collect())
}

enum DeviceKind {
    Input,
    Output,
}

pub fn get_input_devices() -> Result<Vec<AudioDevice>> {
    collect_devices(DeviceKind::Input)
}

pub fn get_output_devices() -> Result<Vec<AudioDevice>> {
    collect_devices(DeviceKind::Output)
}

pub struct SpeakerInput;

impl SpeakerInput {
    // Always fails, which `check_system_audio_access` reports to the frontend as
    // "no access" rather than an error state.
    pub fn new(_device_id: Option<String>) -> Result<Self> {
        Err(anyhow::anyhow!(
            "system audio capture is unavailable: this build was compiled without cidre, \
             which needs a full Xcode install"
        ))
    }

    pub fn stream(self) -> SpeakerStream {
        SpeakerStream
    }
}

pub struct SpeakerStream;

impl SpeakerStream {
    pub fn sample_rate(&self) -> u32 {
        0
    }
}

impl Stream for SpeakerStream {
    type Item = f32;

    fn poll_next(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        Poll::Ready(None)
    }
}
