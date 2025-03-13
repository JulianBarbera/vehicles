use serde::Deserialize;
use std::{
    fs,
    path::{Path, PathBuf},
    io
};

#[derive(Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct VehicleType {
    pub manufacturer: String,
    pub model: String,
    pub roster: Vec<Roster>
}

#[derive(Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct Roster {
    pub fleet_selection: FleetSelector,
    pub engine: Option<String>,
    pub transmission: Option<String>,
    pub notes: Option<String>,
    pub years: Option<Vec<u16>>,
    pub division: Option<String>
}

//range numbers are inclusive on both sides.
//for example, to iterate, do
//for i in start_number..=end_number
#[derive(Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct FleetSelector {
    pub start_number: Option<u32>,
    pub end_number: Option<u32>,
    pub start_text: Option<String>,
    pub end_text: Option<String>,
    pub use_numeric_sorting: bool
}

#[derive(Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct RootOfVehicleFile {
    pub vehicles: Vec<VehicleType>
}

fn find_json_files_recursive(dir: &Path) -> io::Result<Vec<PathBuf>> {
    let mut json_files: Vec<PathBuf> = Vec::new();
    if dir.is_dir() {
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                let sub_dir_json_files = find_json_files_recursive(&path)?; // Recursive call for subdirectories
                json_files.extend(sub_dir_json_files); // Add JSON files from subdirectory
            } else if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
                json_files.push(path); // Add JSON file path to the list
            }
        }
    }
    Ok(json_files)
}

fn main() {
    //recursively look through folders in the parent folder vehicles, find all json files and test them for validity

    let folder_path = Path::new("vehicles");

    let vehicle_files = find_json_files_recursive(folder_path).unwrap();

    for file_path in vehicle_files {

        println!("Checking file {:?}", file_path);

        let file_read_to_string = std::fs::read_to_string(&file_path).unwrap();
        let vehicles = serde_json::from_str::<RootOfVehicleFile>(&file_read_to_string);

        match vehicles {
            Ok(_) => println!("File {:?} is valid", file_path),
            Err(e) => println!("File {:?} is invalid: {:?}", file_path, e)
        }
    }
}

