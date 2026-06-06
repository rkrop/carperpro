# Snapshot file
# Unset all aliases to avoid conflicts with functions
# Functions
env_has_pending_build () 
{ 
    if [[ "${REPLIT_NIX}" -nt "${SHELL_ENV}" ]] || [[ "${DOT_REPLIT}" -nt "${SHELL_ENV}" ]] || [[ "${MODULES_STAMP}" -nt "${SHELL_ENV}" ]]; then
        if [[ -f "${SHELL_ENV_ERROR}" ]]; then
            if [[ "${REPLIT_NIX}" -nt "${SHELL_ENV_ERROR}" ]] || [[ "${DOT_REPLIT}" -nt "${SHELL_ENV_ERROR}" ]] || [[ "${MODULES_STAMP}" -nt "${SHELL_ENV_ERROR}" ]]; then
                return 0;
            else
                return 1;
            fi;
        else
            return 0;
        fi;
    else
        return 1;
    fi
}
maybe_install_nix_module () 
{ 
    TOOL_NAME="$1";
    MODULE_ID="$2";
    yes_or_no "Install Replit's ${TOOL_NAME} tools" || return 1;
    result="$(/nix/store/vqapsnihn8flnsc1z7392b7m7f64g85n-curl-8.14.1-bin/bin/curl --silent --header "Content-Type: application/json" --request POST --data "{\"ids\":[\"${MODULE_ID}\"]}" localhost:8283/nixmodule/add)";
    if [[ "${result}" != '{"status":"ok"}' ]]; then
        echo -e "\e[0;33m${__REPLIT_LOGO} Failed to add tools, check whether your .replit file is properly formatted.\e[0m" 1>&2;
        return 1;
    fi
}
maybe_notify_error () 
{ 
    if [[ -f "${SHELL_ENV_ERROR}" && "${ACTIVE_TS}" -lt "$(/nix/store/rry6qingvsrqmc7ll7jgaqpybcbdgf5v-coreutils-9.7/bin/date -r "${SHELL_ENV_ERROR}" "${TS_FMT}" 2> /dev/null || echo 0)" ]]; then
        echo -e "\e[0;33m${__REPLIT_LOGO} Failed to compile new environment.\e[0m" 1>&2;
        echo -e "\e[0;33m${__REPLIT_LOGO} Run \`cat ${SHELL_ENV_ERROR}\` to display the error.\e[0m" 1>&2;
        ACTIVE_TS="$(/nix/store/rry6qingvsrqmc7ll7jgaqpybcbdgf5v-coreutils-9.7/bin/date -r "${SHELL_ENV_ERROR}" "${TS_FMT}" 2> /dev/null || echo 0)";
    fi
}
prompt_command () 
{ 
    history -a;
    if [[ -f "${SHELL_ENV}" ]] && [[ "${ACTIVE_TS}" -lt "$(/nix/store/rry6qingvsrqmc7ll7jgaqpybcbdgf5v-coreutils-9.7/bin/date -r "${SHELL_ENV}" "${TS_FMT}" 2> /dev/null || echo 0)" ]]; then
        update_environment;
    fi
}
update_environment () 
{ 
    ACTIVE_TS="$(/nix/store/rry6qingvsrqmc7ll7jgaqpybcbdgf5v-coreutils-9.7/bin/date -r "${SHELL_ENV}" "${TS_FMT}")";
    source "${SHELL_ENV}" || exit
}
wait_till_env_up_to_date () 
{ 
    if env_has_pending_build; then
        echo -ne "\e[33m${__REPLIT_LOGO} Waiting for environment to update.";
        /nix/store/rry6qingvsrqmc7ll7jgaqpybcbdgf5v-coreutils-9.7/bin/sleep 1;
        while env_has_pending_build; do
            echo -n ".";
            /nix/store/rry6qingvsrqmc7ll7jgaqpybcbdgf5v-coreutils-9.7/bin/sleep 1;
        done;
        echo -ne "\e[0m\r";
    fi
}
yes_or_no () 
{ 
    while true; do
        printf "\e[33m$* [y/n] %s \e[0m" "${__REPLIT_LOGO}";
        read -rp "" yn;
        case $yn in 
            [Yy]*)
                return 0
            ;;
            [Nn]*)
                echo "Aborted";
                return 1
            ;;
        esac;
    done
}

# setopts 3
set -o braceexpand
set -o hashall
set -o interactive-comments

# aliases 0

# exports 129
declare -x ADMINTOTAL_API_KEY="RR8ISS8VRU96SRFTMBZ5H0SRKY3H9HMEBVT"
declare -x ADMINTOTAL_CLAVE="https://carper.admintotal.com"
declare -x ADMINTOTAL_WEBHOOK_TOKEN="carper_wh_b1504f0aac7aedd6e2842e2564c9a82e91fb9e3e4c9ea9b7"
declare -x AI_INTEGRATIONS_OPENAI_API_KEY="_DUMMY_API_KEY_"
declare -x AI_INTEGRATIONS_OPENAI_BASE_URL="http://localhost:1106/modelfarm/openai"
declare -x CARPER_NOTIFY_SMS_TO="+526441225597"
declare -x CLERK_PUBLISHABLE_KEY="pk_test_cG93ZXJmdWwtbWFzdGlmZi05Mi5jbGVyay5hY2NvdW50cy5kZXYk"
declare -x CLERK_SECRET_KEY="sk_test_tK2CPXptyRps3RJKRtxmUC5oWUuSAvxdVgkBJ6IO8S"
declare -x CODEX_HOME="/home/runner/workspace/.codex"
declare -x CODEX_MANAGED_BY_NPM="1"
declare -x CODEX_MANAGED_PACKAGE_ROOT="/home/runner/workspace/node_modules/.pnpm/@openai+codex@0.137.0/node_modules/@openai/codex"
declare -x COLORTERM="truecolor"
declare -x CONNECTORS_HOSTNAME="connectors.replit.com"
declare -x DATABASE_URL="postgresql://postgres:password@helium/heliumdb?sslmode=disable"
declare -x DISPLAY=":0"
declare -x DOCKER_CONFIG="/home/runner/workspace/.config/docker"
declare -x EXPO_TOKEN="VDjRAoOunwUsLGRIBB-I8qmv6fd1RcZ-k5zrsg_3"
declare -x GEMINI_API_KEY="AQ.Ab8RN6L7NgFFeWDy4FvNF8CMNLW-bKp9BeoD9CiGc4-Z7K7lrg"
declare -x GIT_ASKPASS="replit-git-askpass"
declare -x GIT_CONFIG_GLOBAL="/run/replit/user/59552634/.config/git/config"
declare -x GIT_EDITOR="replit-git-editor"
declare -x GIT_PAGER=""
declare -x GIT_TERMINAL_PROMPT="0"
declare -x GLIBC_TUNABLES="glibc.rtld.optional_static_tls=10000"
declare -x GOPROXY="http://package-firewall.replit.local/go/"
declare -x GOSUMDB="off"
declare -x HISTCONTROL="ignoredups"
declare -x HISTFILE="/run/replit/user/59552634/.bash_history"
declare -x HISTFILESIZE="100000"
declare -x HISTSIZE="10000"
declare -x HOME="/home/runner"
declare -x LANG="en_US.UTF-8"
declare -x LD_AUDIT="/nix/store/sj11ljhx4n79h9g0167f8lg8hp7n545m-replit_rtld_loader-1/rtld_loader.so"
declare -x LIBGL_DRIVERS_PATH="/nix/store/l4myp7qn0q9bqgmkqq4vnnii22ql1r68-mesa-25.0.7/lib/dri"
declare -x LOCALE_ARCHIVE="/usr/lib/locale/locale-archive"
declare -x LS_COLORS="rs=0:di=01;34:ln=01;36:mh=00:pi=40;33:so=01;35:do=01;35:bd=40;33;01:cd=40;33;01:or=40;31;01:mi=00:su=37;41:sg=30;43:ca=00:tw=30;42:ow=34;42:st=37;44:ex=01;32:*.7z=01;31:*.ace=01;31:*.alz=01;31:*.apk=01;31:*.arc=01;31:*.arj=01;31:*.bz=01;31:*.bz2=01;31:*.cab=01;31:*.cpio=01;31:*.crate=01;31:*.deb=01;31:*.drpm=01;31:*.dwm=01;31:*.dz=01;31:*.ear=01;31:*.egg=01;31:*.esd=01;31:*.gz=01;31:*.jar=01;31:*.lha=01;31:*.lrz=01;31:*.lz=01;31:*.lz4=01;31:*.lzh=01;31:*.lzma=01;31:*.lzo=01;31:*.pyz=01;31:*.rar=01;31:*.rpm=01;31:*.rz=01;31:*.sar=01;31:*.swm=01;31:*.t7z=01;31:*.tar=01;31:*.taz=01;31:*.tbz=01;31:*.tbz2=01;31:*.tgz=01;31:*.tlz=01;31:*.txz=01;31:*.tz=01;31:*.tzo=01;31:*.tzst=01;31:*.udeb=01;31:*.war=01;31:*.whl=01;31:*.wim=01;31:*.xz=01;31:*.z=01;31:*.zip=01;31:*.zoo=01;31:*.zst=01;31:*.avif=01;35:*.jpg=01;35:*.jpeg=01;35:*.jxl=01;35:*.mjpg=01;35:*.mjpeg=01;35:*.gif=01;35:*.bmp=01;35:*.pbm=01;35:*.pgm=01;35:*.ppm=01;35:*.tga=01;35:*.xbm=01;35:*.xpm=01;35:*.tif=01;35:*.tiff=01;35:*.png=01;35:*.svg=01;35:*.svgz=01;35:*.mng=01;35:*.pcx=01;35:*.mov=01;35:*.mpg=01;35:*.mpeg=01;35:*.m2v=01;35:*.mkv=01;35:*.webm=01;35:*.webp=01;35:*.ogm=01;35:*.mp4=01;35:*.m4v=01;35:*.mp4v=01;35:*.vob=01;35:*.qt=01;35:*.nuv=01;35:*.wmv=01;35:*.asf=01;35:*.rm=01;35:*.rmvb=01;35:*.flc=01;35:*.avi=01;35:*.fli=01;35:*.flv=01;35:*.gl=01;35:*.dl=01;35:*.xcf=01;35:*.xwd=01;35:*.yuv=01;35:*.cgm=01;35:*.emf=01;35:*.ogv=01;35:*.ogx=01;35:*.aac=00;36:*.au=00;36:*.flac=00;36:*.m4a=00;36:*.mid=00;36:*.midi=00;36:*.mka=00;36:*.mp3=00;36:*.mpc=00;36:*.ogg=00;36:*.ra=00;36:*.wav=00;36:*.oga=00;36:*.opus=00;36:*.spx=00;36:*.xspf=00;36:*~=00;90:*#=00;90:*.bak=00;90:*.crdownload=00;90:*.dpkg-dist=00;90:*.dpkg-new=00;90:*.dpkg-old=00;90:*.dpkg-tmp=00;90:*.old=00;90:*.orig=00;90:*.part=00;90:*.rej=00;90:*.rpmnew=00;90:*.rpmorig=00;90:*.rpmsave=00;90:*.swp=00;90:*.tmp=00;90:*.ucf-dist=00;90:*.ucf-new=00;90:*.ucf-old=00;90:"
declare -x NIXPKGS_ALLOW_UNFREE="1"
declare -x NIX_PATH="nixpkgs=/home/runner/.nix-defexpr/channels/nixpkgs-stable-25_05:/home/runner/.nix-defexpr/channels"
declare -x NODE_PATH="/home/runner/workspace/node_modules/.pnpm/@openai+codex@0.137.0/node_modules/@openai/codex/bin/node_modules:/home/runner/workspace/node_modules/.pnpm/@openai+codex@0.137.0/node_modules/@openai/codex/node_modules:/home/runner/workspace/node_modules/.pnpm/@openai+codex@0.137.0/node_modules/@openai/node_modules:/home/runner/workspace/node_modules/.pnpm/@openai+codex@0.137.0/node_modules:/home/runner/workspace/node_modules/.pnpm/node_modules"
declare -x NPM_CONFIG_REGISTRY="http://package-firewall.replit.local/npm/"
declare -x OPENAI_API_KEY="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"
declare -x OPENAI_REPLIT="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"
declare -x PAGER="cat"
declare -x PATH="/home/runner/workspace/.codex/tmp/arg0/codex-arg0Vt1pq4:/home/runner/workspace/node_modules/.pnpm/@openai+codex@0.137.0-linux-x64/node_modules/@openai/codex/vendor/x86_64-unknown-linux-musl/codex-path:./node_modules/.bin:/home/runner/workspace/node_modules/.bin:/nix/store/bgwr5i8jf8jpg75rr53rz3fqv5k8yrwp-postgresql-16.10/bin:/home/runner/workspace/.pythonlibs/bin:/nix/store/flbj8bq2vznkcwss7sm0ky8rd0k6kar7-python-wrapped-0.1.0/bin:/nix/store/xwg0ddq9mjf6ibwdvp93jsp0cf51z3xr-pip-wrapper/bin:/nix/store/ypy3l3k428kc1kmcw090wlbxi8vj1m8l-poetry-wrapper/bin:/nix/store/6m2322jq0rkfdnv6cm3dq8437djbfv1l-uv-0.9.5/bin:/nix/store/17prmkcmwjif1sbpgpfb12dn94psc4gd-npx/bin:/home/runner/workspace/.config/npm/node_global/bin:/home/runner/workspace/node_modules/.bin:/nix/store/s7awkfc4pym4zj139fsxrjs5xwf5hhnd-nodejs-24.13.0-wrapped/bin:/nix/store/1xk3mgscq548ypyrgm2n5kwdii92w9ql-bun-1.3.6/bin:/nix/store/61lr9izijvg30pcribjdxgjxvh3bysp4-pnpm-10.26.1/bin:/nix/store/23078nfww258q1vjxbmyak0svvxcvj4s-yarn-1.22.22/bin:/nix/store/8sa75mbvbn3kxicggyyjggmkigvzddks-prettier-3.6.2/bin:/nix/store/fnd18kbs6y7dkx4qhzwd51l87wdnsg06-pid1/bin:/nix/store/7j13wlk62abj5lz3ml9j91lkwah1mmsz-replit-runtime-path/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
declare -x PGDATABASE="heliumdb"
declare -x PGHOST="helium"
declare -x PGPASSWORD="password"
declare -x PGPORT="5432"
declare -x PGUSER="postgres"
declare -x PIP_CONFIG_FILE="/nix/store/z0d7kvaycmw342xmz4xwwybm6p3p0zcs-pip.conf"
declare -x PIP_INDEX_URL="http://package-firewall.replit.local/pypi/simple/"
declare -x PIP_TRUSTED_HOST="package-firewall.replit.local"
declare -x PNPM_PACKAGE_NAME="workspace"
declare -x POETRY_CACHE_DIR="/home/runner/workspace/.cache/pypoetry"
declare -x POETRY_CONFIG_DIR="/nix/store/cyg6h5fbgsfqdimyrc1gflmpx8p0hbkv-poetry-config"
declare -x POETRY_DOWNLOAD_WITH_CURL="1"
declare -x POETRY_INSTALLER_MODERN_INSTALLATION="1"
declare -x POETRY_PIP_FROM_PATH="1"
declare -x POETRY_PIP_NO_ISOLATE="1"
declare -x POETRY_PIP_NO_PREFIX="1"
declare -x POETRY_PIP_USE_PIP_CACHE="1"
declare -x POETRY_USE_USER_SITE="1"
declare -x POETRY_VIRTUALENVS_CREATE="0"
declare -x PROMPT_DIRTRIM="2"
declare -x PYTHONPATH="/nix/store/y50fwh2sha400s38m12psfxpvk2c8w39-sitecustomize/lib/python/site-packages:/nix/store/sqs1z4grvym0nv6r3ksdc990m8sr5wgx-python3.11-pip-25.0.1/lib/python3.11/site-packages"
declare -x PYTHONUSERBASE="/home/runner/workspace/.pythonlibs"
declare -x REPLIT_ARTIFACT_ROUTER="/nix/store/wg7b85swh7pm5bpwmkq35f36p0y3yzr3-artifact-router-0.1.0/bin/artifact-router"
declare -x REPLIT_ASKPASS_PID2_SESSION="pid2-client-ChxKIJM4EJ3pc_BQCUh-f"
declare -x REPLIT_BASHRC="/nix/store/lsgsb0ar7rdwa09d1z2dnfjh4188pddk-replit-bashrc/bashrc"
declare -x REPLIT_CLI="/nix/store/7chhsvpki2vn1fv0jjvdgbqiqwqdzir6-replit-cli-0.0.1/bin/replit"
declare -x REPLIT_CLUSTER="janeway"
declare -x REPLIT_CONNECTORS_HOSTNAME="connectors.replit.com"
declare -x REPLIT_CONTAINER="repl"
declare -x REPLIT_DB_URL="https://kv.replit.com/v0/eyJhbGciOiJIUzUxMiIsImlzcyI6InJlcGx2aXNvciIsImtpZCI6InByb2Q6MSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJyZXBsdmlzb3IiLCJleHAiOjE3ODEwMDY4MjcsImlhdCI6MTc4MDcxODgyNywiZGF0YWJhc2VfaWQiOiIxYWUwMDNkOC0wZjFhLTRiOGQtYmZlNC02ODkyNWQ1N2Y4YzUifQ.rfvZKQUeNst4rfMI3p8GUkDCCuq6VGFsSVHyT5B6E5mBnG4KgKEEnHjvmVOBXiZakoocMZL9X733CILGPXQ8Ew"
declare -x REPLIT_DEV_DOMAIN="1ae003d8-0f1a-4b8d-bfe4-68925d57f8c5-00-2aed5kf98n5if.janeway.replit.dev"
declare -x REPLIT_DOMAINS="1ae003d8-0f1a-4b8d-bfe4-68925d57f8c5-00-2aed5kf98n5if.janeway.replit.dev"
declare -x REPLIT_EXPO_DEV_DOMAIN="1ae003d8-0f1a-4b8d-bfe4-68925d57f8c5-00-2aed5kf98n5if.expo.janeway.replit.dev"
declare -x REPLIT_HELIUM_ENABLED="true"
declare -x REPLIT_LD_AUDIT="/nix/store/sj11ljhx4n79h9g0167f8lg8hp7n545m-replit_rtld_loader-1/rtld_loader.so"
declare -x REPLIT_MODE="agent"
declare -x REPLIT_NIX_CHANNEL="stable-25_05"
declare -x REPLIT_PID1_VERSION="0.0.270"
declare -x REPLIT_PID2="true"
declare -x REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE="/nix/store/kcvsxrmgwp3ffz5jijyy7wn9fcsjl4hz-playwright-browsers-1.55.0-with-cjk/chromium-1187/chrome-linux/chrome"
declare -x REPLIT_PYTHONPATH="/home/runner/workspace/.pythonlibs/lib/python3.11/site-packages:/nix/store/lxnbcmx15m3yascasf4c9qh7zk19pd2b-python3.11-setuptools-80.9.0/lib/python3.11/site-packages"
declare -x REPLIT_PYTHON_LD_LIBRARY_PATH="/nix/store/pya3p1ihjm446jpqpql93542cirqyn23-cpplibs/lib:/nix/store/c2qsgf2832zi4n29gfkqgkjpvmbmxam6-zlib-1.3.1/lib:/nix/store/f7rcazhd826xlcz43il4vafv28888cgj-glib-2.86.3/lib:/nix/store/ii3ybky5dqjikcrw7vdnh1j76ssy0ycm-libx11-1.8.12/lib:/nix/store/zshby6nalhw4mvap0rr97hv042808c2k-libxext-1.3.6/lib:/nix/store/0r6d7iw0q9wgxxj28zy87n1gjwvk0klp-libxinerama-1.1.5/lib:/nix/store/bb5xxw11ndww7iivcmdpxga9n1da24vg-libxcursor-1.2.3/lib:/nix/store/dyn0y5clf5b556yqwmj4841h43hz75p6-libxrandr-1.5.4/lib:/nix/store/x1f9a0qsj6a1y5nf178naagm2vbxnazc-libxi-1.8.2/lib:/nix/store/pv432a54y6di3n12iqix2dglkswvq1px-libxxf86vm-1.1.6/lib"
declare -x REPLIT_RIPPKGS_INDICES="/nix/store/cg6q7dm7h9jp20vwj79ahnbsd9cs6iay-rippkgs-indices"
declare -x REPLIT_RTLD_LOADER="1"
declare -x REPLIT_RUN_PATH="/run/replit"
declare -x REPLIT_SESSION="pid2-client-ChxKIJM4EJ3pc_BQCUh-f"
declare -x REPLIT_USER="ramikr0"
declare -x REPLIT_USERID="59552634"
declare -x REPLIT_USER_RUN="/run/replit/user/59552634"
declare -x REPL_HOME="/home/runner/workspace"
declare -x REPL_ID="1ae003d8-0f1a-4b8d-bfe4-68925d57f8c5"
declare -x REPL_IDENTITY="v2.public.Q2lReFlXVXdNRE5rT0Mwd1pqRmhMVFJpT0dRdFltWmxOQzAyT0RreU5XUTFOMlk0WXpVU0IzSmhiV2xyY2pBYUVFRjFkRzh0VUdGeWRITXRVM1J2Y21VaUpERmhaVEF3TTJRNExUQm1NV0V0TkdJNFpDMWlabVUwTFRZNE9USTFaRFUzWmpoak5UajY1ckljV2drS0IycGhibVYzWVhrPQ-Asg57EtALwHF65r0b6xUTB3Ja1BHKZ-pbGNa1O8-ol4VvXF8tDxZZ1WRCwlKELlgcZSblEN824xPJMkoY-QA.R0FFaUNYSmxjR3gyYVhOdmNoS0JDSFl5TG5CMVlteHBZeTVSTW1RelUxUk9UV0pWT0hkVlZteFNaSHBzY0U5VWJETlNWazVGVVZkd2VWcDZXa1ZWYTBwdlVraGplV05xVFhwUlZrcDJVVEJrUWxaWFJrdGFNamx5VkZaa1IySkZNVVZSV0hCaFVrZGtNRlJWWkZwbFJteFVUVVJDV21GdGFISlVSbVJMWWxad1ZWVllVazloYldNeFZGZHdWMkV3TlZWYVJ6RlFVakF3ZUZJeVpISlZNRWw2VTIxb2FWWXllSGxaTW5CQ1dWVktWV0ZxV1RGamEyeHFVakprY21GVlNYbGpSMmhwWWxaWmVsZFdhSEpaVlVad1lqQkdTbUZzV25sVVYyc3haREpTV0ZOdVRtaFdNREV4V1ZST1drMXNXbGhhTTJ4YVZrVmFUMVJyVlRCTmJIQnlWMnBLYUdGdGRETldWbHAzVW0xR1dXRkZlR3hTUlhCaFdWVmFjMU5YUmxobFJsWlRUVVZhY0ZwVldrdGtSa1Y0VW0wNVVsVlVNRGxxVVdoaWFHNXdSM2hIVEROb2VWbzRlbEkwWVdwVWJVWklkMHRaVUZaU2NVVkROazh4UkZoc1MybEhkVWRrZUZvMlprSTRVMTlVUlU5Q1J5MUpkRnBrZUd0YWRsTlRVV0pWVm1ORWF6RlJka1ZTYnpsQ1VTNVNNRVpHWVZWS2RGUnVXbWxpVkVadldXMW9UVmxyUm5WWFdHeE5ZbXRKZUZkWE1UUmpSbXcxVGxaS1RtSldTVEpXVkVaclRVZFdkRk5zV2xSaWJrSlhWbTB4TkZVeFVuSlZiVVpPVm01Q1YxVXlkRTlXUmxwWllVVldWbVZyU25KVmFrRXhVMVpHY2xOc1drNVNiSEJUVm0xd1QxbFhVbGRpTTJoVFlsZG9VMVpxU205a1ZsWllaRWQwYVdKRk5WaFphMVpQVm0xS1ZXSkZWbFpoYTBwSVdrZDRjMVpzU25WU2JFcFhWbGhDU2xZeWNFTmpNV1J6VW14b2FGTkdjRk5VVldSVFVURmFSMXBGWkZKaVZWcEpWMnRWZUZVd01YUlZhM1JYVFZaYVZGVlVTa3BrTVZKeVlVWktWMkV4Y0haV1ZscHJZakpLYzFSdVNtbFRSVnBZV1cxMGQxUXhiRmRWYkdST1RWaENTRmRyVmpCaGF6RnlWMnhzVjFKdGFGaFdSRVpoWkVkV1NXTkdaRmRpVmtwSlZrWlNTMVF5VFhsVGFscFdZWHBzV0ZSWGVFdGlNVmw1VFZSU1ZFMXJXa2RVVmxaclZrZEtSbGRzV2xwV2VrVXdWMVphYzA1c1JsVlNiWEJwVWxoQ05sWkVSbGRaVjBWNVUyeHNWbFpGV2xkWmExcGhZMnh3U0dWRldteFNia0pHVmpJeGQyRkhSWGhqUnpsWFlXdGFWRlY2Ums1bFJscHpVMnhHVjFKRlNqTldNblJoVjIxT2RHTkZNVkJYUlRSNldrVldXazVXY0VWU1dGSnBZbFJXVVZRd1pHRlZiVXBZWVVSS1ZGSldjSGhXYTFaeVpFZFNSV0ZGY0dsaVZuQlJWMFJKZUZaVk1YUlplbEpxVjBoQ1JsVnJaRlpPUmxwRllrWlNhRTFXU2paWGJYaHZZbGRXY21KNlFsaFdWVEUyVjIxemQyVnNaRlpPV0VwVVZrZFNXVmRYYTNkT1ZrcHlWVzA1VDJGVVJreFVha2sxVWtWNGMxTllaRk5oTVhCdlZteFdkMDFHV2toT1YwWm9WakJ3VmxWdE1EVlhiVXBZVldwS1ZtRnJjRkJWTVZwUFpGWmtkRkpzVGxObGJXY3c"
declare -x REPL_IDENTITY_KEY="k2.secret.zgY5c2NxgDV8GhBbQDY-Ir8oyFjmDCXC79Y5En7eZpOS_pSHZrUzg3p8W-P3RBkSLErHZiFgeKVMYBvFGYJCEA"
declare -x REPL_IN_MICROVM="true"
declare -x REPL_LANGUAGE="nix"
declare -x REPL_OWNER="ramikr0"
declare -x REPL_OWNER_ID="59552634"
declare -x REPL_PUBKEYS="{\"crosis-ci\":\"7YlpcYh82oR9NSTtSYtR5jDL4onNzCGJGq6b+9CuZII=\",\"crosis-ci:1\":\"7YlpcYh82oR9NSTtSYtR5jDL4onNzCGJGq6b+9CuZII=\",\"crosis-ci:latest\":\"7YlpcYh82oR9NSTtSYtR5jDL4onNzCGJGq6b+9CuZII=\",\"prod\":\"tGsjlu/BJvWTgvMaX7acuUb7AO1dXOrRiuk7y083RFE=\",\"prod:1\":\"tGsjlu/BJvWTgvMaX7acuUb7AO1dXOrRiuk7y083RFE=\",\"prod:3\":\"9+MCOSHQSQlcodXoot8dC8NLhc862nLkx1/VMsbY2h8=\",\"prod:4\":\"8uGN+vfszlnV93/HCSHlVLG0xddMlPkir1Ni4JKT4+w=\",\"prod:5\":\"9+MCOSHQSQlcodXoot8dC8NLhc862nLkx1/VMsbY2h8=\",\"prod:latest\":\"tGsjlu/BJvWTgvMaX7acuUb7AO1dXOrRiuk7y083RFE=\",\"vault-goval-token\":\"D5jJoMx1Ml54HM92NLgXl+MzptwDqbSsfyFG6f52g9E=\",\"vault-goval-token:1\":\"D5jJoMx1Ml54HM92NLgXl+MzptwDqbSsfyFG6f52g9E=\",\"vault-goval-token:latest\":\"D5jJoMx1Ml54HM92NLgXl+MzptwDqbSsfyFG6f52g9E=\"}"
declare -x REPL_SLUG="workspace"
declare -x SESSION_SECRET="8zc1QvmJIs/FVEHuIgrPK2zr4x+2kptfBtCJf/v6JlkVbBPcJqO8TNqcUKBQYqglENMxgn+mDc0o4o7O29G7aw=="
declare -x SHLVL="2"
declare -x TERM="dumb"
declare -x TWILIO_AUTH_TOKEN="05bc3162e6bdd5e35ac57ffb68fe0c5a"
declare -x TWILIO_PHONE_NUMBER="+15109303585"
declare -x TWILIO_VERIFY_SERVICE_SID="VA18ebfb97843782323728954c8c280dd0"
declare -x TZDIR="/etc/zoneinfo"
declare -x UV_PROJECT_ENVIRONMENT="/home/runner/workspace/.pythonlibs"
declare -x UV_PYTHON_DOWNLOADS="never"
declare -x UV_PYTHON_PREFERENCE="only-system"
declare -x VITE_CLERK_PUBLISHABLE_KEY="pk_test_cG93ZXJmdWwtbWFzdGlmZi05Mi5jbGVyay5hY2NvdW50cy5kZXYk"
declare -x WHATSAPP_ACCESS_TOKEN="79f6443b128ae03f2f1dfbc102f946a5"
declare -x WHATSAPP_PHONE_NUMBER_ID="6441225597"
declare -x XDG_CACHE_HOME="/home/runner/workspace/.cache"
declare -x XDG_CONFIG_HOME="/home/runner/workspace/.config"
declare -x XDG_DATA_DIRS="/nix/store/7j13wlk62abj5lz3ml9j91lkwah1mmsz-replit-runtime-path/share"
declare -x XDG_DATA_HOME="/home/runner/workspace/.local/share"
declare -x YARN_NPM_REGISTRY_SERVER="http://package-firewall.replit.local/npm/"
declare -x YARN_REGISTRY="http://package-firewall.replit.local/npm/"
declare -x __EGL_VENDOR_LIBRARY_FILENAMES="/nix/store/l4myp7qn0q9bqgmkqq4vnnii22ql1r68-mesa-25.0.7/share/glvnd/egl_vendor.d/50_mesa.json"
declare -x npm_command="exec"
declare -x npm_config_prefix="/home/runner/workspace/.config/npm/node_global"
declare -x npm_config_registry="http://package-firewall.replit.local/npm/"
declare -x npm_config_user_agent="pnpm/10.26.1 npm/? node/v24.12.0 linux x64"
declare -x npm_config_verify_deps_before_run="false"
declare -x pnpm_config_verify_deps_before_run="false"
