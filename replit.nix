# Nix toolchain for Little Journey on Replit.
# Expo SDK 54 requires Node 20.x.
{ pkgs }: {
  deps = [
    pkgs.nodejs_20
    pkgs.nodePackages.npm
  ];
}
