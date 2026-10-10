use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::{distributions::Alphanumeric, Rng};
use sha2::{Digest, Sha256};

pub struct Pkce {
    pub verifier: String,
    pub challenge: String,
}

#[derive(Clone, Copy)]
pub enum ChallengeEncoding {
    /// RFC 7636 S256: BASE64URL(SHA256(verifier)). Google, Meta, X.
    Base64Url,
    /// TikTok's desktop Login Kit expects the SHA256 digest hex-encoded.
    Hex,
}

pub fn random_string(len: usize) -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(len)
        .map(char::from)
        .collect()
}

pub fn generate(encoding: ChallengeEncoding) -> Pkce {
    let verifier = random_string(64);
    let digest = Sha256::digest(verifier.as_bytes());
    let challenge = match encoding {
        ChallengeEncoding::Base64Url => URL_SAFE_NO_PAD.encode(digest),
        ChallengeEncoding::Hex => digest.iter().map(|b| format!("{b:02x}")).collect(),
    };
    Pkce { verifier, challenge }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rfc7636_appendix_b_vector() {
        let digest = Sha256::digest(b"dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
        assert_eq!(URL_SAFE_NO_PAD.encode(digest), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    }

    #[test]
    fn verifier_is_valid_length() {
        let p = generate(ChallengeEncoding::Hex);
        assert_eq!(p.verifier.len(), 64);
        assert_eq!(p.challenge.len(), 64);
    }
}
