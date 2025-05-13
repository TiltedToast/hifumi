{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
    nixpkgs-unstable.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs =
    {
      nixpkgs,
      nixpkgs-unstable,
      ...
    }:
    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forEachSupportedSystem =
        f:
        nixpkgs.lib.genAttrs supportedSystems (
          system:
          f rec {
            pkgs = import nixpkgs { inherit system; };
            pkgs-unstable = import nixpkgs-unstable { inherit system; };
            libPath = pkgs.lib.makeLibraryPath [
              pkgs-unstable.stdenv.cc.cc.lib
            ];
          }
        );

    in
    {
      devShells = forEachSupportedSystem (
        {
          pkgs,
          pkgs-unstable,
          libPath,
        }:
        {
          default = pkgs.mkShell {
            buildInputs = [
              pkgs-unstable.bun
              pkgs-unstable.stdenv.cc.cc.lib
            ];

            shellHook = ''
              export LD_LIBRARY_PATH="${libPath}"
            '';
          };
        }
      );
    };
}
