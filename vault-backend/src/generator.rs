use rand::Rng;

const UPPERCASE: &str = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const UPPERCASE_FULL: &str = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE: &str = "abcdefghjkmnpqrstuvwxyz";
const LOWERCASE_FULL: &str = "abcdefghijklmnopqrstuvwxyz";
const NUMBERS: &str = "23456789";
const NUMBERS_FULL: &str = "0123456789";
const SYMBOLS: &str = "!@#$%^&*()-_=+[]{}|;:,.<>?";
const AMBIGUOUS: &str = "0O1lI";

pub fn generate(
    length: usize,
    uppercase: bool,
    lowercase: bool,
    numbers: bool,
    symbols: bool,
    exclude_ambiguous: bool,
) -> String {
    let mut charset = String::new();

    if uppercase {
        if exclude_ambiguous {
            charset.push_str(UPPERCASE);
        } else {
            charset.push_str(UPPERCASE_FULL);
        }
    }
    if lowercase {
        if exclude_ambiguous {
            charset.push_str(LOWERCASE);
        } else {
            charset.push_str(LOWERCASE_FULL);
        }
    }
    if numbers {
        if exclude_ambiguous {
            charset.push_str(NUMBERS);
        } else {
            charset.push_str(NUMBERS_FULL);
        }
    }
    if symbols {
        charset.push_str(SYMBOLS);
    }

    if charset.is_empty() {
        charset.push_str(LOWERCASE_FULL);
    }

    let charset: Vec<char> = charset.chars().collect();
    let mut rng = rand::thread_rng();
    let mut password: Vec<char> = (0..length)
        .map(|_| charset[rng.gen_range(0..charset.len())])
        .collect();

    // Ensure at least one character from each enabled set
    let mut guaranteed = Vec::new();
    if uppercase && !charset.is_empty() {
        let up: Vec<char> = if exclude_ambiguous { UPPERCASE.chars().collect() } else { UPPERCASE_FULL.chars().collect() };
        if !up.is_empty() { guaranteed.push(up[rng.gen_range(0..up.len())]); }
    }
    if lowercase && !charset.is_empty() {
        let lo: Vec<char> = if exclude_ambiguous { LOWERCASE.chars().collect() } else { LOWERCASE_FULL.chars().collect() };
        if !lo.is_empty() { guaranteed.push(lo[rng.gen_range(0..lo.len())]); }
    }
    if numbers {
        let nu: Vec<char> = if exclude_ambiguous { NUMBERS.chars().collect() } else { NUMBERS_FULL.chars().collect() };
        if !nu.is_empty() { guaranteed.push(nu[rng.gen_range(0..nu.len())]); }
    }
    if symbols {
        let sy: Vec<char> = SYMBOLS.chars().collect();
        if !sy.is_empty() { guaranteed.push(sy[rng.gen_range(0..sy.len())]); }
    }

    // Replace first N characters with guaranteed ones
    for (i, ch) in guaranteed.into_iter().enumerate() {
        if i < password.len() {
            password[i] = ch;
        }
    }

    // Shuffle
    use rand::seq::SliceRandom;
    password.shuffle(&mut rng);

    password.into_iter().collect()
}
