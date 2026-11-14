"""Apply the narrow native-font-menu patch to the pinned official source checkout."""
from pathlib import Path
import json
import sys

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]).resolve()
path = source / 'crates/ui-egui/src/text/font_filters.rs'
text = path.read_text(encoding='utf-8')
old = 'let t = photocraft_text::try_shared()?.lock().unwrap_or_else(PoisonError::into_inner).fonts.family_traits(family);'
new = '''let loaded = photocraft_text::try_shared()
        .and_then(|engine| engine.lock().unwrap_or_else(PoisonError::into_inner).fonts.family_traits(family));
    let t = with_host_class(family, loaded);'''
assert text.count(old) == 1, 'Upstream code changed: review patch rather than applying blindly'
text = text.replace(old, new)
anchor = '/// Narrow and order the menu\'s `rows` by `filters`.'
helper = '''// Host classifications are available before a served font is fetched. Keep its real
// format, PANOSE and weight once loaded; the curated class remains consistent.
fn with_host_class(family: &str, loaded: Option<FamilyTraits>) -> Option<FamilyTraits> {
    let class = host_class(family);
    match (loaded, class) {
        (Some(mut traits), Some(class)) => {
            traits.class = Some(class);
            Some(traits)
        }
        (Some(traits), None) => Some(traits),
        (None, Some(class)) => Some(FamilyTraits {
            class: Some(class), format: FontFormat::TrueType, panose: [0; 10], weight: 400,
        }),
        (None, None) => None,
    }
}

include!("host_font_classes.rs");

'''
assert text.count(anchor) == 1
text = text.replace(anchor, helper + anchor)
test_anchor = '    fn t(class: FontClass, format: FontFormat, panose: [u8; 10], weight: u16) -> Option<FamilyTraits> {'
tests = '''    #[test]
    fn host_categories_work_before_download_and_keep_loaded_traits() {
        let serif = with_host_class("Liberation Serif", None).expect("catalog family");
        assert_eq!(serif.class, Some(FontClass::Serif));
        let decorative = with_host_class("Star Minor", None).expect("catalog family");
        assert_eq!(decorative.class, Some(FontClass::Decorative));
        let loaded = FamilyTraits { class: None, format: FontFormat::Variable, panose: [2; 10], weight: 700 };
        let completed = with_host_class("Inter", Some(loaded.clone())).expect("known family");
        assert_eq!(completed.class, Some(FontClass::SansSerif));
        assert_eq!(completed.format, loaded.format);
        assert_eq!(completed.panose, loaded.panose);
        assert_eq!(completed.weight, loaded.weight);
        assert_eq!(with_host_class("Unknown Family", None), None);
        assert_eq!(with_host_class("Unknown Family", Some(loaded.clone())), Some(loaded));
    }

'''
assert text.count(test_anchor) == 1
text = text.replace(test_anchor, tests + test_anchor)
path.write_text(text, encoding='utf-8', newline='\n')

keys = {'Serif': 'Serif', 'Slab Serif': 'SlabSerif', 'Sans Serif': 'SansSerif',
        'Script': 'Script', 'Monospace': 'Monospace', 'Handwritten': 'Handwritten',
        'Blackletter': 'Blackletter', 'Decorative': 'Decorative'}
catalog = json.loads((root / 'host/font-catalog.json').read_text(encoding='utf-8'))
# Exact names commonly supplied by Windows; no proprietary font data is embedded.
windows = {
    'Serif': ['Times New Roman', 'Cambria', 'Georgia', 'Constantia', 'Book Antiqua', 'Palatino Linotype', 'Baskerville Old Face', 'Garamond'],
    'Slab Serif': ['Rockwell', 'Rockwell Extra Bold'],
    'Sans Serif': ['Arial', 'Arial Black', 'Calibri', 'Aptos', 'Aptos Display', 'Segoe UI', 'Segoe UI Variable', 'Tahoma', 'Verdana', 'Trebuchet MS', 'Impact', 'Century Gothic', 'Bahnschrift'],
    'Monospace': ['Consolas', 'Courier New', 'Lucida Console'],
    'Handwritten': ['Comic Sans MS', 'Segoe Print', 'Bradley Hand ITC'],
    'Script': ['Segoe Script', 'Brush Script MT', 'Monotype Corsiva', 'Edwardian Script ITC'],
    'Blackletter': ['Old English Text MT'],
    'Decorative': ['Jokerman', 'Algerian', 'Chiller', 'Papyrus', 'Showcard Gothic', 'Stencil', 'Ravie', 'Castellar', 'Copperplate Gothic Bold', 'Copperplate Gothic Light', 'Harrington', 'Broadway', 'Curlz MT'],
}
known = {font['family'] for font in catalog}
for category, names in windows.items():
    catalog.extend({'family': name, 'category': category} for name in names if name not in known)
arms = '\n'.join(f'        {json.dumps(font["family"])} => Some(FontClass::{keys[font["category"]]}),'
                 for font in sorted(catalog, key=lambda f: f['family']))
generated = 'fn host_class(family: &str) -> Option<FontClass> {\n    match family {\n' + arms + '\n        _ => None,\n    }\n}\n'
(path.parent / 'host_font_classes.rs').write_text(generated, encoding='utf-8', newline='\n')
print(f'Patched font menu with {len(catalog)} family classifications; no font bytes embedded.')
