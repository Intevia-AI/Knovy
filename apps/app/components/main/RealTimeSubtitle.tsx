          <Button
            variant="outline"
            size="sm"
            onClick={() => setSubtitleVisibility(!isSubtitleVisible)}
            className="flex items-center gap-0.5 text-[10px] h-6"
          >
            {isSubtitleVisible ? (
              <EyeOffIcon className="h-2.5 w-2.5" />
            ) : (
              <EyeIcon className="h-2.5 w-2.5" />
            )}
            {isSubtitleVisible ? t("hideSubtitlesButton") : t("showSubtitlesButton")}
          </Button> 