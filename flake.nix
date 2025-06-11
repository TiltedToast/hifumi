{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";
    nixpkgs-unstable.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      nixpkgs,
      nixpkgs-unstable,
      flake-utils,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
        pkgs-unstable = import nixpkgs-unstable {
          inherit system;
          config.allowUnfree = true;
        };
        libPath = pkgs.lib.makeLibraryPath [
          pkgs-unstable.stdenv.cc.cc.lib
        ];
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs-unstable; [
            bun
            stdenv.cc.cc.lib
            pm2
          ];

          shellHook = ''
            export LD_LIBRARY_PATH="${libPath}"
          '';
        };
      }
    );
}
