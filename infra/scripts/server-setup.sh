#!/usr/bin/env bash
# Первичная настройка нового сервера Ubuntu 24.04 LTS (ТЗ, п. 8.1). Запуск один раз от root:
#   SSH_PORT=2222 bash server-setup.sh
# Что делает: пользователь deploy (вход только по ключу), SSH на нестандартном порту, запрет root и паролей,
# файрвол (открыты только SSH, 80, 443), fail2ban, автоматические обновления безопасности, Docker, swap.
set -euo pipefail
SSH_PORT="${SSH_PORT:-2222}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"

[ "$(id -u)" = 0 ] || { echo "Запускайте от root"; exit 1; }
[ -s /root/.ssh/authorized_keys ] || { echo "Сначала добавьте свой SSH-ключ в /root/.ssh/authorized_keys — иначе после настройки не войти"; exit 1; }

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg ufw fail2ban unattended-upgrades git rclone gpg cron

# Пользователь для работы и выкладки — с тем же ключом, что у root
id "$DEPLOY_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$DEPLOY_USER"
usermod -aG sudo "$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /root/.ssh/authorized_keys "/home/$DEPLOY_USER/.ssh/authorized_keys"
echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/90-$DEPLOY_USER"

# SSH: свой порт, только ключи, без root
cat > /etc/ssh/sshd_config.d/90-lflame.conf <<CONF
Port $SSH_PORT
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
MaxAuthTries 3
CONF

# Файрвол
ufw default deny incoming
ufw default allow outgoing
ufw allow "$SSH_PORT"/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

# fail2ban для SSH
cat > /etc/fail2ban/jail.d/sshd.local <<CONF
[sshd]
enabled = true
port = $SSH_PORT
maxretry = 5
bantime = 1h
CONF
systemctl enable --now fail2ban

# Автоматические обновления безопасности
dpkg-reconfigure -f noninteractive unattended-upgrades

# Docker (официальный репозиторий)
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
usermod -aG docker "$DEPLOY_USER"
# Docker не должен открывать порты в обход ufw: все наши порты, кроме 80/443, слушают только 127.0.0.1

# Swap 4 ГБ (сборка Next.js требовательна к памяти)
if ! swapon --show | grep -q .; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi

systemctl restart ssh
echo
echo "Готово. Дальше входите так:  ssh -p $SSH_PORT $DEPLOY_USER@<IP сервера>"
echo "Не закрывайте это окно, пока не проверите вход в новом окне."
