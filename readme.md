# Catenary Vehicles

Open source database of vehicle data. Designed to work with catenarytransit/catenary-backend. 

## Schema

Quite simple.

```rust
pub struct RootOfVehicleFile {
    pub vehicles: Vec<VehicleType>
}

pub struct VehicleType {
    pub manufacturer: String,
    pub model: String,
    pub roster: Vec<Roster>
}

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
pub struct FleetSelector {
    pub start_number: Option<u32>,
    pub end_number: Option<u32>,
    pub start_text: Option<String>,
    pub end_text: Option<String>,
    pub use_numeric_sorting: bool
}
```

More fields can be added if people request them.

## Check validity

```bash
cargo run
```

## Language

The notes must be in the language of the local agency. Adding English or another language is optional. For example, Agencies in Quebec should use French.
Ottawa notes should be bilingual. Belgium buses should be in French and Dutch.