# ControlsPanel with Integrated Light System

The ControlsPanel has been completely updated to include an integrated Light Debugger with tab navigation. Here's how to use it:

## Overview

The ControlsPanel now features:

- **Tab-based navigation** between Scene controls and Light controls
- **Integrated Light Debugger** functionality in the Lights tab
- **Real-time light manipulation** without needing a separate component
- **Clean organization** of all development tools in one place

## Accessing the Controls

1. **Open the Controls Panel**: Click the Settings icon (⚙️) in the top-right corner of any page with a 3D scene
2. **Switch between tabs**: Use the "Scene" and "Lights" tabs at the top of the panel

## Scene Tab

The Scene tab contains all the original functionality:

- **Camera controls** (scroll/orbit mode switching)
- **Scene settings** (wireframe, rotation axis)
- **ASCII effect controls** (all parameters for the ASCII post-processing effect)

## Lights Tab

The Lights tab contains the integrated Light Debugger with:

### Global Controls

- **Enable Lights**: Toggle all lighting on/off
- **Show Helpers**: Display visual indicators for light positions
- **Add New Light**: Create custom lights programmatically
- **Add Animation Example**: Set up example scroll-based light animations

### Individual Light Controls

For each light in the scene, you can adjust:

- **Enable/Disable**: Toggle individual lights
- **Light Type**: Switch between Point Light, Spotlight, and Directional Light
- **Position**: X, Y, Z coordinates with number inputs
- **Color**: Color picker for light color
- **Intensity**: Brightness control
- **Spotlight-specific controls**:
  - **Angle**: Spotlight cone angle in radians
  - **Penumbra**: Softness of the light edge
- **Animation**: Toggle whether the light participates in scroll animations

### Export Tools

- **Export Config**: Copy the entire light configuration to clipboard as JSON
- **Copy Positions**: Copy just the current light positions for easy reference

## Benefits of the New System

1. **Single Interface**: All development tools are now in one organized panel
2. **Better Organization**: Tab system keeps related controls together
3. **Space Efficient**: No overlapping interfaces or separate windows
4. **Persistent Access**: Available on any page with 3D content through the same controls panel
5. **Better UX**: Integrated scrollbar and consistent styling

## Usage Examples

### Quick Light Positioning

1. Go to the home page (or any page with the 3D scene)
2. Click the Settings icon
3. Switch to the "Lights" tab
4. Enable "Show Helpers" to see light positions
5. Adjust X, Y, Z values for any light to reposition it
6. Use "Copy Positions" to save the coordinates for later use

### Adding Custom Lights

1. In the Lights tab, click "Add New Light"
2. A new "Custom Light" will appear in the list
3. Adjust its type, position, color, and intensity
4. Use "Export Config" to save your custom setup

### Setting Up Animations

1. Enable "Animatable" for any light you want to animate
2. Click "Add Animation Example" to see how keyframe animations work
3. The lights will now respond to scroll position on the page

## Migration from Standalone LightDebugger

The standalone `LightDebugger` component has been completely integrated into the `ControlsPanel`. The `/debug` page now shows instructions on how to access the new integrated system instead of having its own toggle button.

All functionality has been preserved and enhanced:

- ✅ All light manipulation features
- ✅ Real-time position adjustment
- ✅ Color and intensity controls
- ✅ Light type switching
- ✅ Animation toggles
- ✅ Export functionality
- ✅ Add/remove lights
- ➕ Better organization with tabs
- ➕ Integrated with existing controls
- ➕ Consistent styling and UX

This creates a much more professional and organized development environment for working with the 3D scene and lighting system.
