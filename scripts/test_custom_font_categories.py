"""Run the exact patched Rust classification helpers with upstream's real data types.

This small regression harness avoids compiling the unrelated native GPU/editor UI.
The full integration is compiled separately by the official WebAssembly build.
"""
from pathlib import Path
import json
import subprocess
import sys
import tempfile

source = Path(sys.argv[1]).resolve()
root = Path(__file__).resolve().parents[1]
classes = (source / 'crates/text/src/font_class.rs').read_text(encoding='utf-8')
filters = (source / 'crates/ui-egui/src/text/font_filters.rs').read_text(encoding='utf-8')

def item(text, marker):
    start = text.index(marker)
    opening = text.index('{', start)
    depth = 1
    end = opening + 1
    while depth:
        if text[end] == '{':
            depth += 1
        elif text[end] == '}':
            depth -= 1
        end += 1
    return text[start:end]

def definition(marker):
    derive_start = classes.rfind('#[derive(', 0, classes.index(marker))
    derive_end = classes.index('\n', derive_start)
    return classes[derive_start:derive_end] + '\n' + item(classes, marker)

definitions = '\n'.join(definition(marker) for marker in
                        ('pub enum FontClass', 'pub enum FontFormat', 'pub struct FamilyTraits'))
helper = item(filters, 'fn with_host_class')
catalog = (source / 'crates/ui-egui/src/text/host_font_classes.rs').read_text(encoding='utf-8')
regression = item(filters, 'fn host_categories_work_before_download_and_keep_loaded_traits')
expected = []
keys = {'Slab Serif': 'SlabSerif', 'Sans Serif': 'SansSerif'}
for font in json.loads((root / 'host/font-catalog.json').read_text(encoding='utf-8')):
    expected.append(f'assert_eq!(with_host_class({json.dumps(font["family"])}, None).unwrap().class, Some(FontClass::{keys.get(font["category"], font["category"])}));')
definitions += '\n' + item(classes, 'impl FamilyTraits')
definitions += '\n#[derive(Clone, Debug, Default)]\n' + item(filters, 'pub(crate) struct FontFilters')
difference = item(classes, 'pub fn difference')
definitions += '\nmod photocraft_text { pub mod font_class { use crate::FamilyTraits;\n' + difference + '\n}}\n'
definitions += '\nconst SIMILAR_COUNT: usize = 30;\n' + item(filters, "pub(crate) fn apply<'a>")
category_tests = []
data = json.loads((root / 'host/font-catalog.json').read_text(encoding='utf-8'))
families = ', '.join(json.dumps(font['family']) for font in data)
for category in sorted({font['category'] for font in data}):
    names = ', '.join(json.dumps(font['family']) for font in data if font['category'] == category)
    category_tests.append(f'''let mut rows: Vec<(&String, &str)> = families.iter().map(|family| (family, family.as_str())).collect();
    let filters = FontFilters {{ class: Some(FontClass::{keys.get(category, category)}), ..Default::default() }};
    apply(&mut rows, &filters, &[], "", &|family| with_host_class(family, None));
    let actual: Vec<&str> = rows.iter().map(|(_, label)| *label).collect();
    assert_eq!(actual, vec![{names}]);''')
code = definitions + '\n' + helper + '\n' + catalog + '\n#[test]\n' + regression + '\n#[test]\nfn every_hosted_font_is_classified_without_downloading() {\n' + '\n'.join(expected) + '\n}\n'
code += '\n#[test]\nfn actual_menu_filters_include_every_expected_family() {\nlet families: Vec<String> = [' + families + '].into_iter().map(str::to_string).collect();\n' + '\n'.join(category_tests) + '\n}\n'
with tempfile.TemporaryDirectory(prefix='photocraft-font-tests-') as temporary:
    path = Path(temporary) / 'font_tests.rs'
    executable = Path(temporary) / ('font_tests.exe' if sys.platform == 'win32' else 'font_tests')
    path.write_text(code, encoding='utf-8')
    subprocess.run(['rustc', '--edition=2024', '--test', str(path), '-o', str(executable)], check=True)
    subprocess.run([str(executable), '--nocapture'], check=True)
